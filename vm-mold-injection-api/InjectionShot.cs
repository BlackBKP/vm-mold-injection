namespace vm_mold_injection_api
{
    public class InjectionShot
    {
        public required string MachineId { get; set; }
        public required string MoldId { get; set; }
        public int ShotCounter { get; set; }
        public DateTime ShotTime { get; set; }
        public decimal? CycleTimeS { get; set; }
        public decimal CushionMm { get; set; }
        public decimal InjectionPressureBar { get; set; }
        public required string Result { get; set; }
        public required string SourceFile { get; set; }
    }
}
