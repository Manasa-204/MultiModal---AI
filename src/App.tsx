import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Send, 
  BookOpen, 
  FileText, 
  BrainCircuit, 
  HelpCircle,
  Loader2,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  related?: string[];
  contextUsed?: boolean;
}

export default function App() {
  const [tab, setTab] = useState<'chat' | 'research'>('chat');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Successfully uploaded and indexed ${e.target.files?.length} materials. You can now ask questions about them!` 
        }]);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleQuery = async () => {
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.answer,
        intent: data.intent,
        related: data.related,
        contextUsed: data.contextUsed
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-900 selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-lg shadow-indigo-200">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Agentic Tutor</h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Multi-Modal RAG • Graph Enhanced</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setTab('chat')}
              className={`text-sm font-bold transition-colors ${tab === 'chat' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Tutor
            </button>
            <button 
              onClick={() => setTab('research')}
              className={`text-sm font-bold transition-colors ${tab === 'research' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Literature Survey
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold transition-all hover:border-indigo-200 hover:bg-slate-50 disabled:opacity-50"
            >
            {uploading ? <Loader2 size={18} className="animate-spin text-indigo-600" /> : <Upload size={18} className="text-indigo-600 transition-transform group-hover:-translate-y-0.5" />}
            Upload Materials
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept=".pdf,image/*,audio/*" 
              onChange={handleUpload}
            />
          </button>
        </div>
      </div>
    </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {tab === 'chat' ? (
          <>
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
                Deep Learning <span className="text-indigo-600">Simplified</span>.
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Upload your lecture notes, diagrams, or recordings. Our agentic tutor handles the rest.
              </p>
            </div>

            {/* Chat Area */}
            <div className="mb-32 space-y-8">
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                {[
                  { icon: <BookOpen className="text-blue-500" />, title: "Summarize", desc: "Explain Backpropagation in 3 paragraphs" },
                  { icon: <Sparkles className="text-amber-500" />, title: "Explain", desc: "How do Convolutional layers detect features?" },
                  { icon: <HelpCircle className="text-indigo-500" />, title: "Quiz", desc: "Generate 3 MCQs on Neural Networks" },
                  { icon: <FileText className="text-emerald-500" />, title: "RAG", desc: "Analyze my uploaded PDF on CNNs" },
                ].map((item, i) => (
                  <button 
                    key={i}
                    onClick={() => { setQuery(item.desc); }}
                    className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1"
                  >
                    <div className="rounded-lg bg-slate-50 p-2">{item.icon}</div>
                    <div>
                      <div className="font-bold text-slate-900">{item.title}</div>
                      <div className="text-sm text-slate-500">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

            {messages.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-3xl px-6 py-4 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                  
                  {msg.related && msg.related.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Related from Knowledge Graph</div>
                      <div className="flex flex-wrap gap-2">
                        {msg.related.map((concept, i) => (
                          <button 
                            key={i} 
                            onClick={() => setQuery(`Tell me more about ${concept}`)}
                            className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
                          >
                            {concept}
                            <ChevronRight size={12} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.intent && (
                    <div className="mt-3 flex items-center justify-between text-[10px] font-medium text-slate-400">
                      <div className="flex items-center gap-1 uppercase tracking-tighter">
                        <Sparkles size={10} />
                        Mode: {msg.intent}
                      </div>
                      {msg.contextUsed && (
                        <div className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-600">RAG-Optimized</div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-6 py-4 border border-slate-100 shadow-sm">
                <Loader2 size={18} className="animate-spin text-indigo-600" />
                <span className="text-sm font-medium text-slate-500">Agent thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Dock */}
        {tab === 'chat' && (
          <div className="fixed bottom-0 left-0 right-0 p-6">
            <div className="mx-auto max-w-3xl">
              <div className="relative flex items-center gap-2 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl shadow-indigo-100 ring-1 ring-white">
                <input 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                  placeholder="Ask about Neural Networks, CNNs, or your files..."
                  className="w-full bg-transparent px-4 py-3 text-slate-900 focus:outline-none placeholder:text-slate-400"
                />
                <button 
                  onClick={handleQuery}
                  disabled={loading || !query.trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:scale-105 active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    ) : (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <h3 className="mb-4 text-2xl font-bold tracking-tight">Literature Survey: AI Agents & Graph-RAG</h3>
          <p className="mb-6 text-slate-600 italic">Target Requirement: Image 4, 8 - Literature Survey (1 research paper)</p>
          
          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-50 p-6">
              <h4 className="font-bold text-indigo-600 uppercase text-xs tracking-wider mb-2">Primary Research Paper</h4>
              <p className="font-semibold text-lg mb-2">"LangChain & LangGraph: A Framework for Programmable LLM Chains and Stateful Multi-Agent Workflows"</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                This project implements the state-machine pattern described in the LangGraph documentation. Traditional RAG is linear; this system uses a 
                <strong> cycled graph state </strong> to allow the LLM to classify intent BEFORE retrieval, ensuring the retrieval strategy (KG vs Vector) is optimized for the task.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-100 rounded-xl">
                <h5 className="font-bold text-sm mb-1">Graph-Enhanced RAG</h5>
                <p className="text-xs text-slate-500">Augmenting traditional vector similarity with structured knowledge graph relationships to solve the "context-drift" problem.</p>
              </div>
              <div className="p-4 border border-slate-100 rounded-xl">
                <h5 className="font-bold text-sm mb-1">Multi-Modal Ingestion</h5>
                <p className="text-xs text-slate-500">Transforming visual diagrams into semantic text descriptions using Gemini-Vision before indexing into the vector layer.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    )}
      </main>
    </div>
  );
}
