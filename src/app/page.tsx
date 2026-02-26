import {
  Compass,
  BarChart3,
  Globe2,
  Building2,
  TrendingUp,
  Search,
  ArrowRight,
  Star,
} from "lucide-react";

const STATS = [
  { label: "Data Points", value: "18.5M+", icon: BarChart3 },
  { label: "Employers Tracked", value: "243K", icon: Building2 },
  { label: "Countries", value: "249", icon: Globe2 },
  { label: "Forecast Series", value: "56", icon: TrendingUp },
];

const DASHBOARDS = [
  {
    title: "Visa Bulletin Trends",
    description: "Historical cutoff progression, retrogression patterns, and PD forecasts",
    href: "/dashboard/visa-bulletin",
    color: "from-blue-500 to-cyan-400",
  },
  {
    title: "Employer Friendliness",
    description: "Compare employers by sponsorship quality, wages, and audit risk",
    href: "/dashboard/employer",
    color: "from-emerald-500 to-teal-400",
  },
  {
    title: "EB Category Comparison",
    description: "EB2 vs EB3 movement, volatility, and wait time analysis",
    href: "/dashboard/eb-category",
    color: "from-purple-500 to-violet-400",
  },
  {
    title: "Geographic Heatmaps",
    description: "Sponsorship hotspots, filing density, and wage competitiveness by region",
    href: "/dashboard/geographic",
    color: "from-amber-500 to-orange-400",
  },
  {
    title: "Wage Competitiveness",
    description: "Compare your wage to OEWS percentiles and employer benchmarks",
    href: "/dashboard/wage",
    color: "from-rose-500 to-pink-400",
  },
  {
    title: "SOC Demand",
    description: "High-demand occupations, hiring trends, and wage premiums",
    href: "/dashboard/soc-demand",
    color: "from-indigo-500 to-blue-400",
  },
  {
    title: "Processing Speed",
    description: "Case processing velocity, I-485 trends, and center backlog",
    href: "/dashboard/processing",
    color: "from-teal-500 to-emerald-400",
  },
  {
    title: "Backlog Visualization",
    description: "Queue position estimates and years-to-clear projections",
    href: "/dashboard/backlog",
    color: "from-fuchsia-500 to-purple-400",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        {/* Subtle gradient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-emerald-600/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <Compass className="h-10 w-10 text-blue-400" strokeWidth={1.5} />
            <h1 className="font-mono text-sm tracking-widest uppercase text-[var(--muted-foreground)]">
              NorthStar Compass
            </h1>
          </div>

          <h2 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
            Navigate Your{" "}
            <span className="gradient-text">Immigration Journey</span>
          </h2>

          <p className="max-w-xl text-lg text-[var(--muted-foreground)] leading-relaxed">
            Personalized insights powered by{" "}
            <span className="font-mono text-[var(--foreground)]">18.5M+</span> data points.
            Priority date forecasts, employer scores, salary benchmarks — all in one place.
          </p>

          <div className="mt-4 flex gap-4">
            <a
              href="/insights"
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:scale-[1.02]"
            >
              Get Personalized Insights
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="/ask"
              className="flex items-center gap-2 rounded-full border border-[var(--border)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
            >
              <Search className="h-4 w-4" />
              Ask a Question
            </a>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="glass-card grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
              <stat.icon className="mb-1 h-5 w-5 text-[var(--muted-foreground)]" strokeWidth={1.5} />
              <span className="font-mono text-2xl font-bold tracking-tight text-[var(--foreground)]">
                {stat.value}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard Grid */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <Star className="h-5 w-5 text-amber-400" />
          <h3 className="text-2xl font-semibold tracking-tight">Dashboards</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARDS.map((dash, i) => (
            <a
              key={dash.href}
              href={dash.href}
              className={`glass-card group relative overflow-hidden p-5 transition-all hover:scale-[1.02] hover:border-white/20 animate-fade-in opacity-0 stagger-${i + 1}`}
            >
              {/* Gradient accent bar */}
              <div
                className={`mb-3 h-1 w-10 rounded-full bg-gradient-to-r ${dash.color} transition-all group-hover:w-16`}
              />
              <h4 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                {dash.title}
              </h4>
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                {dash.description}
              </p>
              <ArrowRight className="absolute right-4 bottom-4 h-4 w-4 text-[var(--muted-foreground)] opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-8 text-center text-xs text-[var(--muted-foreground)]">
        <p>
          NorthStar Compass — Built on{" "}
          <span className="text-[var(--foreground)]">Horizon</span> data &{" "}
          <span className="text-[var(--foreground)]">Meridian</span> analytics
        </p>
        <p className="mt-1">
          Sources: DOL PERM/LCA, DOS Visa Bulletin, BLS OEWS, USCIS, DHS
        </p>
      </footer>
    </div>
  );
}
