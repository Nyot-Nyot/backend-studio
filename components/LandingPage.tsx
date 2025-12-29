import {
	Activity,
	ArrowRight,
	Box,
	Code2,
	Cpu,
	Database,
	Github,
	Network,
	Shield,
	Sparkles,
	Terminal,
	Zap,
} from "lucide-react";
import React from "react";

interface LandingPageProps {
	onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
	return (
		<div className="h-screen overflow-y-auto bg-slate-950 text-slate-200 selection:bg-brand-500/30 selection:text-white font-sans overflow-x-hidden scroll-smooth">
			{/* Navbar */}
			<nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900 px-8 py-4">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="flex items-center space-x-3">
						<div className="p-2 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-lg shadow-brand-500/20">
							<Box className="w-6 h-6 text-white" />
						</div>
						<span className="text-xl font-bold text-white tracking-tight">Backend Studio</span>
					</div>
					<div className="flex items-center space-x-6">
						<button
							onClick={onStart}
							className="px-5 py-2 bg-white text-slate-950 rounded-full font-bold text-sm hover:bg-slate-200 transition-all shadow-lg active:scale-95"
						>
							Launch Studio
						</button>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="relative pt-40 pb-20 px-8">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-brand-500/10 blur-[120px] rounded-full -z-10 opacity-30"></div>
				<div className="max-w-5xl mx-auto text-center space-y-8">
					<div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-brand-400 animate-enter">
						<Sparkles className="w-3.5 h-3.5" />
						<span>AI-Powered API Simulation</span>
					</div>
					<h1
						className="text-6xl md:text-8xl font-black text-white leading-[1.1] tracking-tight animate-enter"
						style={{ animationDelay: "100ms" }}
					>
						Design & Ship APIs <br />
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-500 to-violet-500">
							Without a Server.
						</span>
					</h1>
					<p
						className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed animate-enter"
						style={{ animationDelay: "200ms" }}
					>
						The professional workspace to architect and simulate backend environments directly in your
						browser. No Node.js, no Cloud setup, just pure productivity.
					</p>
					<div
						className="flex items-center justify-center space-x-4 pt-4 animate-enter"
						style={{ animationDelay: "300ms" }}
					>
						<button
							onClick={onStart}
							className="group px-8 py-4 bg-brand-600 text-white rounded-2xl font-black text-lg hover:bg-brand-500 transition-all shadow-2xl shadow-brand-600/20 flex items-center space-x-2 active:scale-95"
						>
							<span>Get Started Free</span>
							<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
						</button>
						<button className="px-8 py-4 bg-slate-900 text-slate-200 border border-slate-800 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all">
							Documentation
						</button>
					</div>
				</div>

				{/* Hero Visual */}
				<div
					className="max-w-6xl mx-auto mt-20 p-2 bg-slate-900/50 rounded-3xl border border-slate-800 shadow-2xl relative animate-enter"
					style={{ animationDelay: "400ms" }}
				>
					<div className="absolute -top-10 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-brand-500 to-transparent"></div>
					<div className="bg-slate-950 rounded-[1.25rem] overflow-hidden aspect-video border border-slate-900 flex">
						<div className="w-64 border-r border-slate-900 bg-slate-950/50 p-6 space-y-4 hidden md:block">
							<div className="h-4 w-32 bg-slate-900 rounded-full"></div>
							<div className="space-y-2">
								{[1, 2, 3, 4, 5].map(i => (
									<div key={i} className="h-10 bg-slate-900/50 rounded-xl"></div>
								))}
							</div>
						</div>
						<div className="flex-1 p-8 flex flex-col">
							<div className="flex items-center space-x-3 mb-8">
								<div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/20">
									GET 200 OK
								</div>
								<div className="font-mono text-sm text-slate-500">/api/v1/users/me</div>
							</div>
							<div className="flex-1 bg-slate-900/30 rounded-2xl border border-slate-900 p-6 font-mono text-emerald-500/80 text-sm overflow-hidden relative">
								<div className="absolute top-4 right-4 text-slate-700">
									<Terminal className="w-4 h-4" />
								</div>
								<pre>
									{`{
  "user": {
    "id": "USR-7721",
    "name": "Alex Rivier",
    "email": "alex@studio.dev",
    "role": "Lead Architect",
    "status": "online"
  }
}`}
								</pre>
								<div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
							</div>
						</div>
					</div>
					{/* Annotation */}
					<div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-brand-400 shadow-2xl flex items-center space-x-2">
						<Activity className="w-3.5 h-3.5" />
						<span>Interception by Service Worker Active</span>
					</div>
				</div>
			</section>

			{/* Features Grid */}
			<section className="max-w-7xl mx-auto py-32 px-8">
				<div className="text-center mb-20 space-y-4">
					<h2 className="text-4xl font-bold text-white">Full Backend Capabilities. In Your Browser.</h2>
					<p className="text-slate-400 max-w-2xl mx-auto">
						Stop waiting for real APIs. Use our virtual sandbox to design complex behaviors in seconds.
					</p>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					<FeatureCard
						icon={<Cpu className="w-6 h-6 text-brand-500" />}
						title="Service Worker Engine"
						description="Our core technology intercepts real browser network requests and diverts them to your custom mocks instantly."
					/>
					<FeatureCard
						icon={<Database className="w-6 h-6 text-violet-500" />}
						title="Stateful Memory Store"
						description="Simulate real CRUD operations with our in-memory DB. Data persists as you navigate and refresh."
					/>
					<FeatureCard
						icon={<Sparkles className="w-6 h-6 text-amber-500" />}
						title="Gemini AI Generation"
						description="Prompt our integrated AI to generate complex schemas, data structures, and realistic dummy values."
					/>
					<FeatureCard
						icon={<Shield className="w-6 h-6 text-emerald-500" />}
						title="Auth Simulation"
						description="Configure Bearer Tokens or API Keys. Test '401 Unauthorized' scenarios without touching a real server."
					/>
					<FeatureCard
						icon={<Network className="w-6 h-6 text-sky-500" />}
						title="WebSocket Streams"
						description="Design real-time event-driven architectures with our visual WebSocket event designer and simulator."
					/>
					<FeatureCard
						icon={<Activity className="w-6 h-6 text-indigo-500" />}
						title="Traffic Analysis"
						description="Monitor performance, latency, and request frequency across all your simulated endpoints."
					/>
				</div>
			</section>

			{/* Architecture Section */}
			<section className="bg-slate-900/30 border-y border-slate-900 py-32 px-8">
				<div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
					<div className="space-y-8">
						<h2 className="text-5xl font-black text-white leading-tight">Serverless-inside-the-browser.</h2>
						<p className="text-lg text-slate-400 leading-relaxed">
							Most mock tools are static. Backend Studio is dynamic. By running a Service Worker, we
							create a middle-man that acts like a Node.js server but lives entirely inside your browser
							tab.
						</p>
						<ul className="space-y-4">
							<li className="flex items-center space-x-3 text-slate-300">
								<div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500">
									<Zap className="w-3.5 h-3.5" />
								</div>
								<span>Zero latency round-trips</span>
							</li>
							<li className="flex items-center space-x-3 text-slate-300">
								<div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500">
									<Zap className="w-3.5 h-3.5" />
								</div>
								<span>Offline-first development</span>
							</li>
							<li className="flex items-center space-x-3 text-slate-300">
								<div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-500">
									<Zap className="w-3.5 h-3.5" />
								</div>
								<span>100% Privacy - Data never leaves your tab</span>
							</li>
						</ul>
						<button
							onClick={onStart}
							className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-bold hover:bg-white transition-all"
						>
							Start Designing Now
						</button>
					</div>
					<div className="relative group">
						<div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-violet-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
						<div className="relative bg-slate-950 border border-slate-800 rounded-3xl p-10 space-y-8">
							<div className="flex items-center space-x-4">
								<div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-brand-500">
									<Code2 className="w-6 h-6" />
								</div>
								<div>
									<div className="text-white font-bold">fetch('/api/v1/data')</div>
									<div className="text-slate-500 text-xs font-mono">browser_app.js</div>
								</div>
							</div>
							<div className="h-16 w-px bg-gradient-to-b from-brand-500 to-transparent mx-6"></div>
							<div className="flex items-center space-x-4 pl-12">
								<div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/40">
									<Activity className="w-6 h-6" />
								</div>
								<div>
									<div className="text-brand-400 font-bold tracking-tight">
										SERVICE WORKER INTERCEPT
									</div>
									<div className="text-slate-500 text-xs">sw.js (Middleware)</div>
								</div>
							</div>
							<div className="h-16 w-px bg-gradient-to-b from-transparent to-emerald-500 mx-6"></div>
							<div className="flex items-center space-x-4">
								<div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500">
									<Terminal className="w-6 h-6" />
								</div>
								<div>
									<div className="text-white font-bold">200 OK: {`{ "id": 123 }`}</div>
									<div className="text-slate-500 text-xs">Simulated Backend Studio</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Final CTA */}
			<section className="py-40 text-center px-8 relative overflow-hidden">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand-500/20 blur-[150px] rounded-full -z-10"></div>
				<h2 className="text-5xl md:text-7xl font-black text-white mb-8 leading-tight">Ready to architect?</h2>
				<p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
					Join the new era of API-first development. Fast, reliable, and completely serverless.
				</p>
				<button
					onClick={onStart}
					className="px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-xl hover:bg-slate-200 transition-all shadow-2xl active:scale-95"
				>
					Launch Backend Studio
				</button>
			</section>

			{/* Footer */}
			<footer className="border-t border-slate-900 py-20 px-8 text-slate-500 text-sm">
				<div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
					<div className="flex items-center space-x-3">
						<Box className="w-5 h-5 text-brand-500" />
						<span className="font-bold text-white">Backend Studio</span>
						<span className="text-xs">v1.2.0-beta</span>
					</div>
					<div className="flex items-center space-x-8 font-medium">
						<a href="#" className="hover:text-white transition-colors">
							Privacy
						</a>
						<a href="#" className="hover:text-white transition-colors">
							Terms
						</a>
						<a href="#" className="hover:text-white transition-colors flex items-center gap-2">
							<Github className="w-4 h-4" /> Github
						</a>
					</div>
					<p>© 2025 Simulated Cloud Infrastructures Inc.</p>
				</div>
			</footer>
		</div>
	);
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
	<div className="group p-8 bg-slate-900/50 border border-slate-900 rounded-3xl hover:bg-slate-900 hover:border-slate-800 transition-all duration-300">
		<div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center mb-6 border border-slate-800 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
			{icon}
		</div>
		<h3 className="text-lg font-bold text-white mb-3">{title}</h3>
		<p className="text-slate-400 leading-relaxed text-sm">{description}</p>
	</div>
);

export default LandingPage;
