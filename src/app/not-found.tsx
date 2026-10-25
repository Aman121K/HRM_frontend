import Link from "next/link";
import { Compass, Home } from "lucide-react";
export default function NotFound(){return <main className="not-found"><div className="brand-mark"><i/><i/><i/></div><p className="eyebrow">404 · OFF THE ORG CHART</p><h1>This page took an unplanned leave.</h1><p>We couldn’t find the workspace you requested. It may have moved, or the address may be incomplete.</p><div><Link href="/"><Home size={16}/>Return home</Link><Link href="/people"><Compass size={16}/>Browse people</Link></div></main>}
