namespace vm_mold_injection_api
{
    internal static class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            builder.Services.AddProblemDetails();

            string? connectionString = builder.Configuration.GetConnectionString("InjectionShots");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("Configure ConnectionStrings:InjectionShots in appsettings.json.");
            }

            var app = builder.Build();
            app.UseExceptionHandler();

            app.MapGet("/api/injection-shots", (int? limit, CancellationToken cancellationToken) =>
                GetShotsAsync(connectionString, limit, cancellationToken));

            app.Run();
        }

        private static async Task<IResult> GetShotsAsync(string connectionString, int? limit, CancellationToken cancellationToken)
        {
            int rowLimit = limit ?? 100;
            if (rowLimit < 1 || rowLimit > 1000)
            {
                return Results.BadRequest(new { error = "limit must be between 1 and 1000." });
            }

            List<InjectionShot> shots = await ShotReader.ReadAsync(connectionString, rowLimit, cancellationToken);

            return Results.Ok(shots);
        }
    }
}
