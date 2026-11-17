using System.Data;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();

var connectionString = builder.Configuration.GetConnectionString("InjectionShots");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Configure ConnectionStrings:InjectionShots in appsettings.json.");
}

var app = builder.Build();
app.UseExceptionHandler();

app.MapGet("/api/injection-shots", async (int? limit, CancellationToken cancellationToken) =>
{
    var rowLimit = limit ?? 100;
    if (rowLimit is < 1 or > 1000)
    {
        return Results.BadRequest(new { error = "limit must be between 1 and 1000." });
    }

    const string sql = """
        SELECT TOP (@limit)
            machine_id, mold_id, shot_counter, shot_time, cycle_time_s,
            cushion_mm, injection_pressure_bar, result, source_file
        FROM dbo.InjectionShot
        ORDER BY shot_time DESC, machine_id, shot_counter DESC, source_file;
        """;

    var shots = new List<InjectionShot>();
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await using var command = new SqlCommand(sql, connection);
    command.Parameters.Add("@limit", SqlDbType.Int).Value = rowLimit;

    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        shots.Add(new InjectionShot(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetInt32(2),
            reader.GetDateTime(3),
            reader.IsDBNull(4) ? null : reader.GetDecimal(4),
            reader.GetDecimal(5),
            reader.GetDecimal(6),
            reader.GetString(7),
            reader.GetString(8)));
    }

    return Results.Ok(shots);
});

app.Run();

internal sealed record InjectionShot(
    string MachineId,
    string MoldId,
    int ShotCounter,
    DateTime ShotTime,
    decimal? CycleTimeS,
    decimal CushionMm,
    decimal InjectionPressureBar,
    string Result,
    string SourceFile);
