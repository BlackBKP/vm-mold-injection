using System.Data;
using Microsoft.Data.SqlClient;

namespace vm_mold_injection_loader
{
    internal static class ShotWriter
    {
        public static async Task<(int DeletedRows, int InsertedRows)> WriteAsync(string connectionString, string[] paths, List<Shot> shots)
        {
            string operation = "open the SQL connection";

            try
            {
                using var connection = new SqlConnection(connectionString);
                Task openConnection = connection.OpenAsync();
                await openConnection;

                operation = "begin the import transaction";
                using var transaction = connection.BeginTransaction(IsolationLevel.Serializable);

                operation = "delete previous rows";
                int deletedRows = await DeletePreviousRowsAsync(connection, transaction, paths);

                operation = "insert shots";
                int insertedRows = await InsertShotsAsync(connection, transaction, shots);

                operation = "commit the import transaction";
                Task commitTransaction = transaction.CommitAsync();
                await commitTransaction;

                return (deletedRows, insertedRows);
            }
            catch (Exception ex) when (ex is SqlException or InvalidOperationException or ArgumentException)
            {
                throw new InvalidOperationException($"Could not {operation}. {ex.Message}", ex);
            }
        }

        private static async Task<int> DeletePreviousRowsAsync(SqlConnection connection, SqlTransaction transaction, string[] paths)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = @$"
                DELETE FROM dbo.InjectionShot
                WITH (HOLDLOCK)
                WHERE source_file = @source;";
            command.Parameters.Add("@source", SqlDbType.NVarChar, 255);

            int deletedRows = 0;
            foreach (string path in paths)
            {
                string sourceFile = Path.GetFileName(path);
                command.Parameters["@source"].Value = sourceFile;

                try
                {
                    int affectedRows = await command.ExecuteNonQueryAsync();
                    deletedRows += Math.Max(0, affectedRows);
                }
                catch (SqlException ex)
                {
                    throw new InvalidOperationException($"File '{sourceFile}'. {ex.Message}", ex);
                }
            }

            return deletedRows;
        }

        private static async Task<int> InsertShotsAsync(SqlConnection connection, SqlTransaction transaction, List<Shot> shots)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = @$"
            INSERT dbo.InjectionShot (
                machine_id,
                mold_id,
                shot_counter,
                shot_time,
                cycle_time_s,
                cushion_mm,
                injection_pressure_bar,
                result,
                source_file
            ) VALUES (
                @machine,
                @mold,
                @counter,
                @timestamp,
                @cycle,
                @cushion,
                @pressure,
                @result,
                @source
            );";
            command.Parameters.Add("@source", SqlDbType.NVarChar, 255);
            command.Parameters.Add("@machine", SqlDbType.NVarChar, 32);
            command.Parameters.Add("@mold", SqlDbType.NVarChar, 64);
            command.Parameters.Add("@counter", SqlDbType.Int);
            command.Parameters.Add("@timestamp", SqlDbType.DateTime2);

            foreach (string name in new[] { "@cycle", "@cushion", "@pressure" })
            {
                var parameter = command.Parameters.Add(name, SqlDbType.Decimal);
                parameter.Precision = 18;
                parameter.Scale = 6;
            }
            command.Parameters.Add("@result", SqlDbType.NVarChar, 16);

            int insertedRows = 0;
            foreach (var shot in shots)
            {
                command.Parameters["@machine"].Value = shot.Machine;
                command.Parameters["@mold"].Value = shot.Mold;
                command.Parameters["@counter"].Value = shot.ShotCounter;
                command.Parameters["@timestamp"].Value = shot.Timestamp;
                command.Parameters["@cycle"].Value = (object?)shot.CycleTimeSeconds ?? DBNull.Value;
                command.Parameters["@source"].Value = shot.SourceFile;
                command.Parameters["@cushion"].Value = shot.CushionMillimeters;
                command.Parameters["@pressure"].Value = shot.InjectionPressureBar;
                command.Parameters["@result"].Value = shot.Result;
                try
                {
                    int affectedRows = await command.ExecuteNonQueryAsync();
                    insertedRows += Math.Max(0, affectedRows);
                }
                catch (SqlException ex)
                {
                    throw new InvalidOperationException(
                        $"File '{shot.SourceFile}', machine '{shot.Machine}', shot {shot.ShotCounter}. {ex.Message}", ex);
                }
            }

            return insertedRows;
        }
    }
}
