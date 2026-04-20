import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Play,
  LayoutDashboard,
  Network,
  FlaskConical,
  AlertTriangle,
  RefreshCcw,
  Thermometer,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";

const items = [
  { title: "Simulation", url: "/", icon: Play },
  { title: "Overview", url: "/overview", icon: LayoutDashboard },
  { title: "Vulnerability Map", url: "/vulnerability", icon: Network },
  { title: "Scenario Testing", url: "/scenarios", icon: FlaskConical },
  { title: "Shortage Prediction", url: "/shortage", icon: AlertTriangle },
  { title: "Inventory Balancing", url: "/inventory", icon: RefreshCcw },
  { title: "Cold Chain", url: "/cold-chain", icon: Thermometer },
  { title: "Compliance", url: "/compliance", icon: ShieldCheck },
  { title: "Validation Report", url: "/validation", icon: ClipboardCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-5 ${collapsed ? "px-2" : ""}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">SC</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">ABM Dashboard</h2>
                <p className="text-xs text-muted-foreground">Supply Chain</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <span className="text-xs font-bold text-primary-foreground">SC</span>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
