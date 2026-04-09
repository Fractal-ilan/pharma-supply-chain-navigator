import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export function DashboardHeader() {
  return (
    <header className="h-14 flex items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Pharma Supply Chain ABM</h1>
      </div>
      <Badge variant="secondary" className="text-xs">
        Data source: GDELT + FDA
      </Badge>
    </header>
  );
}
