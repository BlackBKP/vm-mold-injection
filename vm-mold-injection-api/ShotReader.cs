using System.Data;
using Microsoft.Data.SqlClient;

namespace vm_mold_injection_api
{
    internal static class ShotReader
    {
        public static async Task<List<InjectionShot>> ReadAsync(string connectionString, int rowLimit, CancellationToken cancellationToken)
        {
            const string sql = @$"
            SELECT TOP (@limit)
                machine_id,
                mold_id,
                shot_counter,
                shot_time,
                cycle_time_s,
                cushion_mm,
                injection_pressure_bar,
                result,
                source_file
            FROM dbo.InjectionShot
            ORDER BY shot_time DESC, machine_id, shot_counter DESC, source_file;";

            var shots = new List<InjectionShot>();
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = new SqlCommand(sql, connection);
            command.Parameters.Add("@limit", SqlDbType.Int).Value = rowLimit;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            bool hasRow = await reader.ReadAsync(cancellationToken);
            while (hasRow)
            {
                var shot = new InjectionShot
                {
                    MachineId = reader.GetString(0),
                    MoldId = reader.GetString(1),
                    ShotCounter = reader.GetInt32(2),
                    ShotTime = reader.GetDateTime(3),
                    CycleTimeS = reader.IsDBNull(4) ? null : reader.GetDecimal(4),
                    CushionMm = reader.GetDecimal(5),
                    InjectionPressureBar = reader.GetDecimal(6),
                    Result = reader.GetString(7),
                    SourceFile = reader.GetString(8)
                };
                shots.Add(shot);

                hasRow = await reader.ReadAsync(cancellationToken);
            }

            return shots;
        }
    }
}
