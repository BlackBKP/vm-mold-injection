# VM Mold Injection

The .NET 10 console loader imports mold injection shot exports into SQL Server. The ASP.NET Core API reads the same `dbo.InjectionShot` table. Both projects are included in `vm-mold-injection-loader.slnx`.

## Download and run on Windows

1. Download `vm-mold-injection-loader-v1.0.0-win-x64.zip` from the [GitHub release](https://github.com/BlackBKP/vm-mold-injection/releases/tag/v1.0.0) and extract the whole ZIP. The package targets 64-bit Windows and includes the .NET runtime.
2. Run the included `schema.sql` in your target SQL Server database.
3. Edit the included `appsettings.json` with your CSV folder and SQL Server connection. See the sample settings below.
4. Open PowerShell in the extracted folder and validate, then import.

```powershell
.\vm-mold-injection-loader.exe --dry-run
.\vm-mold-injection-loader.exe
```

## Run from source

1. Install the .NET 10 SDK and have access to a SQL Server database. Clone this repository.
2. Create a database, select it in SQL Server Management Studio, and execute [schema.sql](vm-mold-injection-loader/schema.sql). The account that runs the loader needs permission to insert and delete rows in the table and to read the columns used by its delete filter.
3. Create a folder for the shot exports. Edit [appsettings.json](vm-mold-injection-loader/appsettings.json) and set `CsvFolder` to that folder. Use an absolute path and escape Windows backslashes in JSON.

   ```json
   {
     "CsvFolder": "C:\\Data\\MoldExports",
     "ConnectionString": "Server=localhost;Database=vm-mold-injection;Integrated Security=True;Encrypt=True"
   }
   ```

   Replace the server and database with your own. Windows authentication uses the identity running the loader. For SQL authentication, supply the connection string through the `MOLD_LOADER_CONNECTION_STRING` environment variable so credentials stay out of the settings file. The variable takes precedence over the JSON setting.

## Validate and import

From the repository root, first validate your exports, then run the import.

```powershell
dotnet run --project vm-mold-injection-loader -- --dry-run
dotnet run --project vm-mold-injection-loader
```

Pass a folder after `--` to override the configured folder. The loader reads every `.csv` directly in that folder.

```csv
Timestamp,Machine,Mold,ShotCounter,CycleTime_s,Cushion_mm,InjPressure_bar,Result
2026-01-15 09:30:42,M01,MX-100,101,31.2,4.2,1180,OK
```

Semicolon-delimited files and timestamps without seconds also work. An `ERR` cycle time is stored as SQL `NULL`. Each row records its original filename in `source_file`.

Reimporting a filename replaces its previous rows in one transaction. Use unique filenames for distinct exports. Review dry-run errors before importing a replacement file. The live import skips rejected rows and commits valid rows, even when a replacement file is incomplete.

Exit codes are `0` for success, `1` for a fatal error, and `2` when any rows were rejected. Check the database with:

```sql
SELECT source_file, COUNT(*) AS shot_count
FROM dbo.InjectionShot
GROUP BY source_file;
```

## Configure and run the API locally

Install the .NET 10 SDK and run the loader's [schema.sql](vm-mold-injection-loader/schema.sql) in your target SQL Server database. Import at least one CSV with the loader if you want to see sample results. The API uses the same database and needs `SELECT` permission on `dbo.InjectionShot`.

Update the connection in [vm-mold-injection-api/appsettings.json](vm-mold-injection-api/appsettings.json). This example uses Windows authentication under the account running the API.

```json
{
  "ConnectionStrings": {
    "InjectionShots": "Server=localhost;Database=vm-mold-injection;Integrated Security=True;Encrypt=True;TrustServerCertificate=False"
  }
}
```

Replace the server and database names with yours. To override the file setting, set `ConnectionStrings__InjectionShots` in the shell that starts the API. Use this override to keep SQL authentication credentials out of source control. For local testing with a self-signed SQL Server certificate, you can set `TrustServerCertificate=True` in the override. Use a trusted certificate when deploying.

From the repository root, start the API on a loopback address.

```powershell
dotnet run --project vm-mold-injection-api --no-launch-profile -- --urls http://127.0.0.1:5204
```

In another PowerShell window, request the latest 10 shots.

```powershell
Invoke-RestMethod 'http://127.0.0.1:5204/api/injection-shots?limit=10'
```

The endpoint returns a JSON array sorted newest first. It defaults to 100 rows, accepts limits from 1 to 1,000, and returns HTTP 400 for invalid limits. An empty database returns an empty array.

Build both projects with `dotnet build vm-mold-injection-loader.slnx`.

## Shop-floor web application

The `vm-mold-injection-web` project serves the single-page shop-floor dashboard and proxies shot requests to the API. It includes selectable molding presses, illustrative molding cycles, playback controls, and light and dark themes. Presses without API records are labeled as demos.

Configure `InjectionApi:Url` in `vm-mold-injection-web/appsettings.json`.

```json
{
  "InjectionApi": {
    "Url": "http://127.0.0.1:5204/api/injection-shots?limit=100"
  }
}
```

Start the API using the command above, then start the web application in another terminal.

```powershell
dotnet run --project vm-mold-injection-web --no-launch-profile -- --urls http://127.0.0.1:5205
```

Open http://127.0.0.1:5205. The dashboard refreshes every 30 seconds. Set `InjectionApi__Url` to override the endpoint through an environment variable. API failures show a connection message and retain previously loaded shots.

Build all three projects with `dotnet build vm-mold-injection-loader.slnx`.
