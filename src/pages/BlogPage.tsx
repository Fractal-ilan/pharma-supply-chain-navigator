import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, BookOpen, BarChart3, Users, FlaskConical } from "lucide-react";

const BLOG_PDF_PATH = "/AI_Inventory_Optimization_Blog.pdf";

const KPIS = [
  { label: "Avg SL Improvement", value: "+4.6pp", icon: BarChart3, color: "text-green-600" },
  { label: "Patient-Days Saved", value: "159K", icon: Users, color: "text-blue-600" },
  { label: "Monte Carlo Runs", value: "300", icon: FlaskConical, color: "text-purple-600" },
  { label: "Scenarios Tested", value: "5", icon: BookOpen, color: "text-amber-600" },
];

export default function BlogPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          AI-Enabled Inventory Optimization
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          How Dynamic Reorder Intelligence Transforms Pharma Supply Chain Resilience
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {KPIS.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="py-4 text-center">
              <kpi.icon className={`w-5 h-5 mx-auto mb-1 ${kpi.color}`} />
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Download Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="py-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Download the Full Blog Post</h2>
            <p className="text-sm text-gray-600 mt-1">
              300 Monte Carlo simulations reveal a +4.6pp service level advantage and 159,000 fewer
              patient-days of drug unavailability. Includes 6 charts, scenario comparison tables, and
              the supply chain infographic.
            </p>
          </div>
          <a
            href={BLOG_PDF_PATH}
            download="AI_Inventory_Optimization_Blog.pdf"
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shrink-0"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </a>
        </CardContent>
      </Card>

      {/* Blog preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <h3 className="text-base font-semibold text-gray-800">The Fragility Problem</h3>
            <p className="text-gray-600">
              Pharmaceutical supply chains span six tiers — from raw material suppliers in China and India,
              through API manufacturers, formulation plants, and distribution centers, all the way to your
              local pharmacy. When disruptions hit, the effects cascade in ways that traditional inventory
              management cannot anticipate. The COVID-19 pandemic made this painfully clear.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4">How AI Inventory Optimization Works</h3>
            <p className="text-gray-600">
              AI-enabled inventory optimization replaces fixed reorder points with dynamic, signal-responsive
              ordering. Each agent continuously monitors demand velocity and adjusts reorder quantities in real
              time. When demand exceeds 1.1x the historical average, the AI triggers an escalation —
              pre-positioning inventory before the shortage fully materializes downstream.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4">Staggered Recovery: Why Timing Matters</h3>
            <p className="text-gray-600">
              Each disruption type follows its own timeline. A cyberattack hits fast and resolves in weeks. An
              India API export ban takes months to unwind. Our model captures these staggered timelines —
              disruptions start at different weeks and their effects linger at different rates based on
              tier-specific lead time multipliers.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4">The Evidence</h3>
            <p className="text-gray-600">
              We tested across five realistic disruption scenarios, each run 30 times with different random
              seeds across both AI and No-AI configurations — 300 Monte Carlo simulations total. The results
              are clear: AI-enabled inventory management outperforms the static baseline in every single
              scenario, with an average improvement of 4.6 percentage points in worst-case service levels.
            </p>

            {/* Scenario table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-2 px-3 text-left font-semibold text-gray-700">Scenario</th>
                    <th className="py-2 px-3 text-center font-semibold text-gray-700">AI Min SL</th>
                    <th className="py-2 px-3 text-center font-semibold text-gray-700">No-AI Min SL</th>
                    <th className="py-2 px-3 text-center font-semibold text-gray-700">Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "India API Ban", ai: "55.7%", noai: "53.0%", imp: "+2.7pp" },
                    { name: "China Lockdown", ai: "50.8%", noai: "48.6%", imp: "+2.2pp" },
                    { name: "US Hurricane", ai: "58.1%", noai: "53.1%", imp: "+5.0pp" },
                    { name: "Cyber Attack", ai: "88.5%", noai: "81.8%", imp: "+6.8pp" },
                    { name: "Quality Crisis", ai: "59.5%", noai: "53.2%", imp: "+6.3pp" },
                  ].map((row, i) => (
                    <tr key={row.name} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="py-2 px-3 font-medium">{row.name}</td>
                      <td className="py-2 px-3 text-center">{row.ai}</td>
                      <td className="py-2 px-3 text-center">{row.noai}</td>
                      <td className="py-2 px-3 text-center font-bold text-green-600">{row.imp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg border text-center">
              <p className="text-gray-500 text-sm italic">
                Download the full PDF for all 6 charts, the supply chain infographic, and detailed analysis.
              </p>
              <a
                href={BLOG_PDF_PATH}
                download="AI_Inventory_Optimization_Blog.pdf"
                className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <FileDown className="w-4 h-4" />
                Download PDF
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
