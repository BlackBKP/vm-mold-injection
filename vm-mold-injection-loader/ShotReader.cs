using System.Globalization;
using Microsoft.VisualBasic.FileIO;

namespace vm_mold_injection_loader
{
    internal static class ShotReader
    {
        private static readonly string[] Headers =
        {
            "Timestamp",
            "Machine",
            "Mold",
            "ShotCounter",
            "CycleTime_s",
            "Cushion_mm",
            "InjPressure_bar",
            "Result"
        };

        public static (List<Shot> Shots, int MissingCycleTimes, int Rejected) ReadFiles(string[] paths)
        {
            var shots = new List<Shot>();
            int rejected = 0;

            foreach (string path in paths)
            {
                rejected += ReadFile(path, shots);
            }

            int missingCycleTimes = shots.Count(shot => shot.CycleTimeSeconds is null);
            return (shots, missingCycleTimes, rejected);
        }

        private static int ReadFile(string path, List<Shot> shots)
        {
            using var reader = File.OpenText(path);
            string header = reader.ReadLine() ?? throw new FormatException($"{path}: empty file.");
            string delimiter = header.Contains(';') ? ";" : ",";

            var fileHeaders = header.Split(delimiter).Select(field => field.Trim().Trim('"'));
            if (!fileHeaders.SequenceEqual(Headers))
            {
                throw new FormatException($"{path}: unexpected CSV header.");
            }

            using var csv = new TextFieldParser(reader);
            csv.SetDelimiters(delimiter);

            int rejected = 0;
            string sourceFile = Path.GetFileName(path);
            while (!csv.EndOfData)
            {
                long line = csv.LineNumber + 1;
                try
                {
                    string[] fields = csv.ReadFields()!;
                    shots.Add(ParseShot(fields, sourceFile));
                }
                catch (Exception ex) when (ex is FormatException or MalformedLineException)
                {
                    rejected++;
                    if (ex is MalformedLineException)
                    {
                        line = csv.ErrorLineNumber + 1;
                    }

                    Console.Error.WriteLine($"{path}:{line}: {ex.Message}");
                }
            }

            return rejected;
        }

        private static Shot ParseShot(string[] fields, string sourceFile)
        {
            if (fields.Length != Headers.Length)
            {
                throw new FormatException($"Expected {Headers.Length} fields, found {fields.Length}.");
            }

            string timestamp = fields[0];
            string timestampFormat = timestamp.Length == 19 ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd HH:mm";
            if (!DateTime.TryParseExact(timestamp, timestampFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            {
                throw new FormatException($"Invalid Timestamp '{timestamp}'.");
            }

            if (!int.TryParse(fields[3], NumberStyles.None, CultureInfo.InvariantCulture, out int counter))
            {
                throw new FormatException($"Invalid ShotCounter '{fields[3]}'.");
            }

            decimal? cycle = fields[4].Equals("ERR", StringComparison.OrdinalIgnoreCase) ? null : Measurement(fields[4], Headers[4]);

            return new Shot
            {
                Timestamp = time,
                Machine = Required(fields[1], Headers[1], 32),
                Mold = Required(fields[2], Headers[2], 64),
                ShotCounter = counter,
                CycleTimeSeconds = cycle,
                CushionMillimeters = Measurement(fields[5], Headers[5]),
                InjectionPressureBar = Measurement(fields[6], Headers[6]),
                Result = Required(fields[7], Headers[7], 16),
                SourceFile = sourceFile
            };
        }

        private static string Required(string value, string name, int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > maxLength)
            {
                throw new FormatException($"{name} must contain 1 to {maxLength} characters.");
            }
            return value;
        }

        private static decimal Measurement(string value, string name)
        {
            if (!decimal.TryParse(value, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
                CultureInfo.InvariantCulture, out decimal number) ||
                Math.Abs(number) >= 1_000_000_000_000m || decimal.Round(number, 6) != number)
            {
                throw new FormatException($"Invalid {name} '{value}'.");
            }
            return number;
        }

    }
}
