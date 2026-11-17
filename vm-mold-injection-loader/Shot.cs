namespace vm_mold_injection_loader
{
    public class Shot
    {
        public DateTime? Timestamp { get; set; }

        public string? Machine { get; set; }

        public string? Mold { get; set; }

        public int? ShotCounter { get; set; }

        public decimal? CycleTimeSeconds { get; set; }

        public decimal? CushionMillimeters { get; set; }

        public decimal? InjectionPressureBar { get; set; }

        public string? Result { get; set; }

        public string? SourceFile { get; set; }
    }
}
