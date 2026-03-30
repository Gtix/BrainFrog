'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bot,
  Brain,
  Shield,
  Zap,
  Puzzle,
  Menu,
  X,
  Github,
  ExternalLink,
  ArrowRight,
  Terminal,
  Star,
  Users,
  Lock,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import ChatDemo from '@/components/agent/chat-demo';
import FeaturesSection from '@/components/agent/features';
import ArchitectureSection from '@/components/agent/architecture';
import SetupSection from '@/components/agent/setup';
import ComparisonSection from '@/components/agent/comparison';

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/3 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-8">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1">
            <Star className="w-3 h-3" /> v1.0.0
          </Badge>
          <span className="text-sm text-muted-foreground">The AI Agent That Shows Its Work</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6">
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Brain Frog
          </span>
        </h1>

        <p className="text-xl sm:text-2xl text-muted-foreground mb-4 font-light">
          The AI Agent That Shows Its Work
        </p>

        <p className="text-base sm:text-lg text-muted-foreground/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          🐸 An AI agent platform with ReAct reasoning, visible tool execution,
          multi-LLM support, conversation branching, and persistent memory.
          Every step of the agent&apos;s thinking is transparent.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-base gap-2"
            onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Bot className="w-5 h-5" />
            Try Live Demo
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="px-8 py-6 text-base gap-2"
            onClick={() => document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Terminal className="w-5 h-5" />
            Setup Guide
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { icon: Shield, label: 'Security Scanning', sublabel: 'Injection detection' },
            { icon: Brain, label: '3-Tier Memory', sublabel: 'Persistent, DB-backed' },
            { icon: Puzzle, label: 'Working Skills', sublabel: 'Extensible' },
            { icon: Zap, label: 'Multi-LLM Support', sublabel: 'Bring your own key' },
          ].map((stat) => (
            <Card key={stat.label} className="bg-background/50 backdrop-blur border-border/50">
              <CardContent className="p-4 text-center">
                <stat.icon className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium">{stat.label}</p>
                <p className="text-xs text-muted-foreground">{stat.sublabel}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronRight className="w-6 h-6 text-muted-foreground rotate-90" />
      </div>
    </section>
  );
}

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Demo', href: '#demo' },
    { label: 'Features', href: '#features' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'Comparison', href: '#comparison' },
    { label: 'Setup', href: '#setup' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-sm' : ''
    }`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/brain-frog-logo.png" alt="Brain Frog" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-lg">Brain Frog</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" asChild>
            <a href="https://github.com/your-org/nexus-agent" target="_blank" rel="noopener noreferrer">
              <Github className="w-4 h-4" /> GitHub
            </a>
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
            Try Demo <ExternalLink className="w-3 h-3" />
          </Button>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="p-2">
            {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-lg border-b border-border/50">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="block text-sm text-muted-foreground hover:text-foreground py-2"
              >
                {item.label}
              </a>
            ))}
            <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => { setIsOpen(false); document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }); }}>
              Try Demo <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/brain-frog-logo.png" alt="Brain Frog" className="w-5 h-5" />
              <span className="font-bold">Brain Frog</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              🐸 Brain Frog — The AI agent that shows its work. ReAct reasoning,
              visible tool execution, multi-LLM support, and persistent memory.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a></li>
              <li><a href="#comparison" className="hover:text-foreground transition-colors">Comparison</a></li>
              <li><a href="#setup" className="hover:text-foreground transition-colors">Setup Guide</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#setup" className="hover:text-foreground transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Skill Development</a></li>
              <li><a href="#features" className="hover:text-foreground transition-colors">Security</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-3">Community</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors flex items-center gap-1.5"><Github className="w-3.5 h-3.5" /> GitHub</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Discord</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contributing Guide</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Code of Conduct</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Brain Frog. Open source under the MIT License.
          </p>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs gap-1">
              <Shield className="w-3 h-3" /> Security Scanning
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <Lock className="w-3 h-3" /> MIT License
            </Badge>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <ChatDemo />
        <FeaturesSection />
        <ArchitectureSection />
        <ComparisonSection />
        <SetupSection />
      </main>
      <Footer />
    </div>
  );
}
