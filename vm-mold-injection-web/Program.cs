using System.Text.Json;

namespace vm_mold_injection_web
{
    internal static class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            builder.Services.AddProblemDetails();
            builder.Services.AddHttpClient("InjectionApi", client => client.Timeout = TimeSpan.FromSeconds(10));

            var app = builder.Build();
            app.UseExceptionHandler();
            app.UseDefaultFiles();
            app.UseStaticFiles();

            app.MapGet("/data/shots", GetShotsAsync);

            app.Run();
        }

        private static async Task<IResult> GetShotsAsync(
            IConfiguration configuration, 
            IHttpClientFactory clients, 
            ILoggerFactory loggerFactory, 
            CancellationToken cancellationToken)
        {
            string? endpoint = configuration["InjectionApi:Url"];
            if (!Uri.TryCreate(endpoint, UriKind.Absolute, out Uri? url) || (url.Scheme != Uri.UriSchemeHttp && url.Scheme != Uri.UriSchemeHttps))
            {
                return Results.Problem("Configure InjectionApi:Url with an absolute HTTP or HTTPS endpoint.");
            }

            try
            {
                using HttpClient client = clients.CreateClient("InjectionApi");
                using HttpResponseMessage response = await client.GetAsync(url, cancellationToken);
                response.EnsureSuccessStatusCode();

                await using Stream body = await response.Content.ReadAsStreamAsync(cancellationToken);
                using JsonDocument json = await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken);
                if (json.RootElement.ValueKind != JsonValueKind.Array)
                {
                    return Results.Problem("The injection shot API returned an unexpected response.", statusCode: 502);
                }

                return Results.Json(json.RootElement.Clone());
            }
            catch (Exception error) when (
                error is HttpRequestException or IOException or JsonException ||
                error is OperationCanceledException && !cancellationToken.IsCancellationRequested)
            {
                ILogger logger = loggerFactory.CreateLogger(typeof(Program).FullName!);
                logger.LogWarning("Injection shot API request failed ({ErrorType}).", error.GetType().Name);
                return Results.Problem("Unable to load shots from the configured API.", statusCode: 502);
            }
        }
    }
}

