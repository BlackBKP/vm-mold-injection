using System.Text.Json;

namespace vm_mold_injection_loader
{
    internal static class Program
    {
        public static async Task<int> Main(string[] args)
        {
            if (args.Contains("--help"))
            {
                Console.WriteLine("Usage: vm-mold-injection-loader [--dry-run] [csv-folder]");
                return 0;
            }

            try
            {
                bool dryRun = args.Contains("--dry-run");
                LoaderSettings? settings = ReadSettings();
                string[] csvFiles = FindCsvFiles(args, settings?.CsvFolder);

                var (shots, missingCycleTimes, rejected) = ShotReader.ReadFiles(csvFiles);
                Console.WriteLine($"Validated {shots.Count} shots, {missingCycleTimes} missing cycle times, {rejected} rejected rows.");

                if (!dryRun)
                {
                    string? connectionString = Environment.GetEnvironmentVariable("MOLD_LOADER_CONNECTION_STRING") ?? settings?.ConnectionString;
                    if (string.IsNullOrWhiteSpace(connectionString))
                    {
                        throw new InvalidOperationException("Set MOLD_LOADER_CONNECTION_STRING or ConnectionString in appsettings.json.");
                    }

                    var (deletedRows, insertedRows) = await ShotWriter.WriteAsync(connectionString, csvFiles, shots);
                    Console.WriteLine($"Committed {insertedRows} shots after deleting {deletedRows} previous rows.");
                }

                return rejected == 0 ? 0 : 2;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex.Message);
                return 1;
            }
        }

        private static LoaderSettings? ReadSettings()
        {
            string path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
            if (!File.Exists(path))
            {
                return null;
            }

            return JsonSerializer.Deserialize<LoaderSettings>(File.ReadAllText(path));
        }

        private static string[] FindCsvFiles(string[] args, string? configuredFolder)
        {
            string[] folders = args.Where(argument => argument != "--dry-run").ToArray();
            if (folders.Length > 1)
            {
                throw new ArgumentException("Supply one CSV folder.");
            }

            string? folder = folders.FirstOrDefault() ?? configuredFolder;
            if (string.IsNullOrWhiteSpace(folder))
            {
                throw new ArgumentException("Supply a CSV folder or set CsvFolder in appsettings.json.");
            }

            string[] csvFiles = Directory.GetFiles(folder, "*.csv");
            if (csvFiles.Length == 0)
            {
                throw new ArgumentException("The folder contains no CSV files.");
            }

            Array.Sort(csvFiles, StringComparer.OrdinalIgnoreCase);
            return csvFiles;
        }
    }

    internal sealed record LoaderSettings(string? CsvFolder, string? ConnectionString);
}
