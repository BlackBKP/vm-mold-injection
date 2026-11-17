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

## Run the API locally

Use the database initialized with the loader's [schema.sql](vm-mold-injection-loader/schema.sql). The API's Windows account needs `SELECT` access to `dbo.InjectionShot`.

Set `ConnectionStrings:InjectionShots` in the API's [appsettings.json](vm-mold-injection-api/appsettings.json) to your SQL Server and database. You can override it with the `ConnectionStrings__InjectionShots` environment variable, for example to supply SQL authentication credentials outside source control.

```powershell
dotnet run --project vm-mold-injection-api --urls http://127.0.0.1:5204
```

Open [the injection shots endpoint](http://127.0.0.1:5204/api/injection-shots?limit=10). The API returns the newest rows first with a default limit of 100 and an allowed range of 1 to 1,000.

If your local SQL Server uses an untrusted certificate, you can set `TrustServerCertificate=True` in your local connection string override. This keeps encryption enabled and skips server certificate validation. Use a trusted certificate for deployed environments.

Build both projects with `dotnet build vm-mold-injection-loader.slnx`.
