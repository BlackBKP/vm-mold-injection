IF OBJECT_ID(N'dbo.InjectionShot', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InjectionShot
    (
        machine_id nvarchar(32) NOT NULL,
        mold_id nvarchar(64) NOT NULL,
        shot_counter int NOT NULL,
        shot_time datetime2(0) NOT NULL,
        cycle_time_s decimal(18,6) NULL,
        cushion_mm decimal(18,6) NOT NULL,
        injection_pressure_bar decimal(18,6) NOT NULL,
        result nvarchar(16) NOT NULL,
        source_file nvarchar(255) NOT NULL
    );
    CREATE INDEX IX_InjectionShot_SourceFile ON dbo.InjectionShot (source_file);
END;
