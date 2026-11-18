# VM Mold Injection

View injection molding shot records on an interactive 3D factory floor.

The system has three applications. The **loader** imports CSV exports from your machines into SQL Server. The **API** reads those records. The **web dashboard** displays the factory floor and the latest available shot for each machine.

```text
Machine CSV exports → Loader → SQL Server → API → Web dashboard
```

## Find what you need

- [Set up the complete system](#set-up-the-complete-system)
- [Deploy a Vercel showcase](#deploy-a-vercel-showcase)
- [Use the dashboard](#use-the-dashboard)
- [Import new machine exports](#import-new-machine-exports)
- [CSV file format](#csv-file-format)
- [Run the Windows loader package](#run-the-windows-loader-package)
- [Troubleshooting](#troubleshooting)
- [Configuration reference](#configuration-reference)

## Set up the complete system

These steps run all three applications on a Windows computer. Run PowerShell commands from the repository folder unless a step says otherwise.

### 1. Prepare your computer

You need the following.

| Requirement | Purpose |
| --- | --- |
| .NET 10 SDK | Builds and runs the applications from source |
| Git | Downloads the source code |
| SQL Server | Stores the machine shot records |
| SQL Server Management Studio or another SQL query tool | Creates the database and table |
| A browser with WebGL enabled | Displays the 3D factory floor |

Download the repository and build the applications.

```powershell
git clone https://github.com/BlackBKP/vm-mold-injection.git
cd vm-mold-injection
dotnet build vm-mold-injection-loader.slnx
```

A successful build ends with `Build succeeded`.

### 2. Create the database table

Connect to SQL Server in your SQL query tool. Create a database named `vm-mold-injection`, or use an existing database.

Select that database and run [schema.sql](vm-mold-injection-loader/schema.sql). This creates the `dbo.InjectionShot` table and its source-file index if the table does not exist.

The Windows account running the loader needs permission to read, insert, and delete rows in this table. The account running the API needs permission to read it.

### 3. Configure the loader

Create a folder such as `C:\Data\MoldExports` and place your machine CSV exports inside it.

Open [the loader settings](vm-mold-injection-loader/appsettings.json) and fill in both values.

```json
{
  "CsvFolder": "C:\\Data\\MoldExports",
  "ConnectionString": "Server=localhost;Database=vm-mold-injection;Integrated Security=True;Encrypt=True;TrustServerCertificate=False"
}
```

Replace `localhost` and `vm-mold-injection` if your SQL Server and database have different names. Windows authentication uses the account running the application. JSON paths use two backslashes between folders.

See [Troubleshooting](#troubleshooting) if SQL Server reports an untrusted certificate.

### 4. Validate and import your files

Validate the CSV files first.

```powershell
dotnet run --project vm-mold-injection-loader -- --dry-run
```

The loader reports the number of valid shots, missing cycle times, and rejected rows. Correct any rejected rows before importing.

Then import the records into SQL Server.

```powershell
dotnet run --project vm-mold-injection-loader
```

A successful import prints a message such as `Committed 23 shots after deleting 0 previous rows.` The loader exits after each run. Repeat the import when new exports are ready.

### 5. Configure and start the API

Open [the API settings](vm-mold-injection-api/appsettings.json). Use the same SQL Server and database as the loader.

```json
{
  "ConnectionStrings": {
    "InjectionShots": "Server=localhost;Database=vm-mold-injection;Integrated Security=True;Encrypt=True;TrustServerCertificate=False"
  }
}
```

Start the API in a PowerShell window.

```powershell
dotnet run --project vm-mold-injection-api --no-launch-profile -- --urls http://127.0.0.1:5204
```

Keep this window open. Wait for `Now listening on: http://127.0.0.1:5204`.

Open [the latest shot](http://127.0.0.1:5204/api/injection-shots?limit=1) in your browser. A working API returns a JSON array. An empty array, `[]`, means the table has no shot records.

### 6. Configure and start the dashboard

Open [the web settings](vm-mold-injection-web/appsettings.json). The API URL should match the address used in step 5.

```json
{
  "InjectionApi": {
    "Url": "http://127.0.0.1:5204/api/injection-shots?limit=100"
  }
}
```

Open a **second PowerShell window** in the repository folder and start the dashboard.

```powershell
dotnet run --project vm-mold-injection-web --no-launch-profile -- --urls http://127.0.0.1:5205
```

Open [the factory dashboard](http://127.0.0.1:5205/). Keep both the API and dashboard windows open while using it. Press **Ctrl+C** in each window when you want to stop the applications.

The startup commands use explicit ports and ignore Visual Studio launch profiles so that the API and dashboard addresses match this guide.

## Deploy a Vercel showcase

The showcase runs the 3D factory floor with **six simulated machines**. Each machine has its own mold, cycle time, pressure, cushion, shot counter, and OK/NG results. Readings advance as simulated shots complete, and the dashboard refreshes every five seconds.

A visible **Showcase · Simulated data** banner identifies the demo. Machine labels show **Demo OK** or **Demo NG**, and the detail panel identifies its simulated readings. All readings are generated in the visitor's browser. The showcase runs as a static website without an API or database.

### Deploy from GitHub

1. Sign in to Vercel and choose **Add New → Project**.
2. Import the GitHub repository **BlackBKP/vm-mold-injection**.
3. Keep **Root Directory** at the repository root.
4. Use **Other** as the framework preset. The repository's [vercel.json](vercel.json) supplies the build command and output directory.
5. Check these build settings, then select **Deploy**.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `Other` |
| Root directory | Repository root |
| Build command | `node scripts/build-showcase.mjs` |
| Output directory | `dist` |
| Install command | Empty |
| Environment variables | None required for the demo |

After deployment, open the URL Vercel provides. Confirm that the showcase banner appears and all six machine buttons have simulated results. Select a machine to inspect its readings, then try orbit, zoom, theme switching, and playback controls.

GitHub pushes to the configured production branch trigger new deployments when Vercel's Git integration is enabled. See [Vercel's build configuration guide](https://vercel.com/docs/builds/configure-a-build) for the project settings.

### Preview the static showcase locally

Install Node.js 22 or later and build the showcase from the repository root.

```powershell
node scripts/build-showcase.mjs
```

The command creates a fresh `dist` folder containing the website and its demo configuration. To preview it using Python 3, run the following command and open [the local showcase](http://127.0.0.1:5300/).

```powershell
python -m http.server 5300 --directory dist --bind 127.0.0.1
```

Keep that terminal open while previewing. Press **Ctrl+C** to stop it. You can also serve `dist` with another static HTTP server.

### Choose demo or API data

The browser reads [dashboard-config.json](vm-mold-injection-web/wwwroot/dashboard-config.json) to choose its data source.

| Where you run it | Data source |
| --- | --- |
| .NET web app using the checked-in settings | API records from `/data/shots`, with the upstream URL configured in `appsettings.json` |
| Generated `dist` website, including Vercel | Simulated records generated in the browser |

The showcase build copies the web assets and writes `{"mode":"demo"}` into `dist/dashboard-config.json`. Its source configuration stays in API mode. Rebuild the showcase after changing web assets.

For a local .NET demo, set `mode` to `demo` in the source browser configuration and reload the page. Set it back to `api` to resume API records.

```json
{
  "mode": "api",
  "shotsUrl": "/data/shots"
}
```

A static deployment can read live records from an HTTPS API by using API mode and that API's public URL as `shotsUrl`. The API must allow the website's origin through CORS. The generated showcase is configured for demo data on every build. Running the .NET API requires separate hosting.

## Use the dashboard

### Explore the factory

| Action | Control |
| --- | --- |
| Rotate the view | Drag on the factory floor |
| Zoom | Scroll the mouse wheel, pinch on a touch screen, or use **+** and **−** |
| Pan | Right-drag |
| Restore the starting camera position | Click **Reset view** |
| Inspect a machine | Click its 3D model, floating label, or machine button below the floor |
| Change the appearance | Click **Dark theme** or **Light theme** |
| Pause or resume machine motion | Click **Pause animation** or **Play animation** |
| Change motion speed | Choose **0.5×**, **1×**, or **2×** |
| Request fresh records immediately | Click **Refresh shots** |

For keyboard navigation, focus the factory view and use the arrow keys to rotate or **+** and **−** to zoom. Use Tab to reach the machine buttons and Enter to select one.

The theme is remembered when browser storage is available. Motion starts paused when your system requests reduced motion.

### Read machine data

Selecting a machine opens its details beside the floor, or below it on smaller screens. The panel shows cycle time, injection pressure, cushion, shot result, mold ID, shot counter, machine timestamp, fetch time, and source filename.

The dashboard refreshes every **5 seconds** while the page is visible. It also refreshes when you return to the page. New records appear after the loader imports their CSV files into SQL Server.

**Last shot time** is the timestamp supplied by the machine export. **Data fetched** is the time the dashboard last received that machine's record. Check both when judging how recent the data is.

### Understand the labels

| Label | Meaning |
| --- | --- |
| **Latest OK** | The latest available shot has an `OK` result |
| **Latest NG**, or another result | The label repeats the latest available shot result |
| **Demo OK** or **Demo NG** | A simulated shot result in showcase mode |
| **Result unavailable** | The returned shot has no result value |
| **Connection lost** | The latest refresh failed. Previously fetched data remains visible |
| **No recent shots** | This machine was seen earlier in the session but is absent from the latest response |
| **Demo** | This press represents an example position and has no connected machine data |

The floor shows at least six presses, filling unused positions with demo presses. Machines are discovered from API records and placed automatically in rows of three. The layout represents the machines returned by the API.

The API URL requests the latest 100 shots across all machines. If a machine is missing, try increasing `limit` up to 1,000. A busy machine can occupy much of that response.

The displayed motion illustrates the clamp, inject, cool, and eject sequence. Playback speed controls the illustration. Machine operating state requires separate telemetry beyond the shot records available here.

## Import new machine exports

1. Copy the completed CSV exports into the configured folder.
2. Run the loader with `--dry-run` and review its output.
3. Correct rejected rows, then run the loader again without `--dry-run`.
4. Check the dashboard after its next refresh, or click **Refresh shots**.

The loader processes every `.csv` directly inside the selected folder. To use a different folder for one run, pass its path.

```powershell
dotnet run --project vm-mold-injection-loader -- --dry-run "C:\Data\NewExports"
dotnet run --project vm-mold-injection-loader -- "C:\Data\NewExports"
```

Reimporting a filename replaces all previously stored rows for that filename in one transaction. Give distinct exports unique filenames.

**Review validation before replacing an export.** A live import skips rejected rows and commits the valid rows, including when replacing an earlier file. A database write failure rolls back the transaction.

| Exit code | Meaning |
| --- | --- |
| `0` | Completed with no rejected rows |
| `1` | A fatal error prevented completion |
| `2` | One or more rows were rejected. A live import may still have committed valid rows |

## CSV file format

Use these column names in this order.

```csv
Timestamp,Machine,Mold,ShotCounter,CycleTime_s,Cushion_mm,InjPressure_bar,Result
2026-01-15 09:30:42,M01,MX-100,101,31.2,4.2,1180,OK
2026-01-15 09:31:13,M01,MX-100,102,ERR,4.1,1190,NG
```

- Commas and semicolons are supported as delimiters.
- Timestamps use `yyyy-MM-dd HH:mm:ss` or `yyyy-MM-dd HH:mm`.
- Decimal values use a period, as in `31.2`.
- `ERR` in `CycleTime_s` becomes SQL `NULL` and appears as **—** in the dashboard.
- The loader saves the original filename with every shot.

## Run the Windows loader package

For importing CSV files with the packaged loader, download `vm-mold-injection-loader-v1.0.0-win-x64.zip` from [release v1.0.0](https://github.com/BlackBKP/vm-mold-injection/releases/tag/v1.0.0).

1. Extract the whole ZIP into a folder on a 64-bit Windows computer.
2. Run the included `schema.sql` in your target database.
3. Edit the included `appsettings.json` with your CSV folder and database connection.
4. Open PowerShell in the extracted folder and run the following commands.

```powershell
.\vm-mold-injection-loader.exe --dry-run
.\vm-mold-injection-loader.exe
```

The package includes the runtime for the loader. Follow [the complete setup](#set-up-the-complete-system) to run the API and 3D dashboard from source.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| `dotnet` is unrecognized, or the .NET 10 SDK is missing | Install the .NET 10 SDK, reopen PowerShell, and check `dotnet --list-sdks` |
| SQL login fails | Check the server name, database name, and permissions of the Windows account running the app |
| `Invalid object name 'dbo.InjectionShot'` | Run `schema.sql` in the database named in the connection string |
| `The certificate chain was issued by an authority that is not trusted` | Use a trusted SQL Server certificate. For local testing with a self-signed certificate, use the override below |
| `Supply a CSV folder` or `The folder contains no CSV files` | Check `CsvFolder` and confirm the files are directly inside that folder |
| `unexpected CSV header` or rejected rows | Compare the file with [the CSV format](#csv-file-format) and review the reported filename and line |
| The API returns `[]` | Verify that the loader imported rows into the same database used by the API |
| The dashboard shows a connection message | Confirm the API is running and `InjectionApi:Url` uses its correct address. Check the API terminal for database errors |
| The page cannot open | Confirm the web app is running and open the exact address shown in its terminal |
| The 3D view cannot start | Enable WebGL and browser graphics acceleration, then reload. Machine buttons below the view still provide access to data |
| A machine is absent or shows **No recent shots** | Check the export's machine ID and timestamp, import the latest file, and review the API row limit |
| The port is already in use | Stop the earlier app with Ctrl+C, or choose another port. Update `InjectionApi:Url` if you change the API port |

For a **local test** against SQL Server with a self-signed certificate, set this environment variable in the same PowerShell window before starting the API.

```powershell
$env:ConnectionStrings__InjectionShots = 'Server=localhost;Database=vm-mold-injection;Integrated Security=True;Encrypt=True;TrustServerCertificate=True'
dotnet run --project vm-mold-injection-api --no-launch-profile -- --urls http://127.0.0.1:5204
```

Replace the server and database as needed. For the loader, use `MOLD_LOADER_CONNECTION_STRING` with the same connection string. This override applies to the current shell and its child processes. Use a trusted SQL Server certificate when deploying.

To check how many records were imported from each file, run this query in the target database.

```sql
SELECT source_file, COUNT(*) AS shot_count
FROM dbo.InjectionShot
GROUP BY source_file
ORDER BY source_file;
```

## Configuration reference

| Application | Settings file | Environment override |
| --- | --- | --- |
| Loader | `vm-mold-injection-loader/appsettings.json` → `CsvFolder`, `ConnectionString` | `MOLD_LOADER_CONNECTION_STRING` overrides the connection. A folder argument overrides `CsvFolder` |
| API | `vm-mold-injection-api/appsettings.json` → `ConnectionStrings:InjectionShots` | `ConnectionStrings__InjectionShots` |
| Dashboard API proxy | `vm-mold-injection-web/appsettings.json` → `InjectionApi:Url` | `InjectionApi__Url` |

Keep SQL authentication credentials in environment variables instead of committing them to the repository.

The API endpoint is `GET /api/injection-shots?limit=100`. It returns a JSON array ordered newest first. The default limit is 100, valid values are 1–1,000, and invalid values return HTTP 400.

The 3D viewer uses locally bundled Three.js 0.180.0. Its MIT license is included in [the vendor folder](vm-mold-injection-web/wwwroot/vendor/three/LICENSE.txt).
