import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  MessageSquare, 
  LayoutDashboard, 
  Calendar, 
  Trophy,
  Send,
  User,
  Bot,
  Loader2,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { getTutorResponse } from './services/geminiService';

// --- Types ---
interface Task {
  id: string;
  title: string;
  tag: '一刷必会' | '二刷深入' | '面试热点';
  url: string;
  completed: boolean;
}

interface DayPlan {
  day: number;
  topic: string;
  tasks: Task[];
  status: 'locked' | 'current' | 'completed';
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface UserSettings {
  dailyHours: number;
  problemsPerDay: number;
  startChapter: string;
  startProblemId: string;
  language: string;
}

// --- Constants ---
const CHAPTERS = [
  "数组", "链表", "哈希表", "字符串", "栈与队列", "二叉树", "回溯算法", "贪心算法", "动态规划", "单调栈", "图论"
];

const CHAPTER_DATA: Record<string, DayPlan[]> = {
  "回溯算法": [
    {
      day: 1,
      topic: '回溯算法：组合问题',
      status: 'current',
      tasks: [
        { id: '77', title: '77. 组合', tag: '一刷必会', url: 'https://programmercarl.com/0077.组合.html', completed: false },
        { id: '216', title: '216. 组合总和 III', tag: '面试热点', url: 'https://programmercarl.com/0216.组合总和III.html', completed: false },
      ]
    },
    {
      day: 2,
      topic: '回溯算法：电话号码的字母组合',
      status: 'locked',
      tasks: [
        { id: '17', title: '17. 电话号码的字母组合', tag: '一刷必会', url: 'https://programmercarl.com/0017.电话号码的字母组合.html', completed: false },
      ]
    },
    {
      day: 3,
      topic: '回溯算法：组合总和 & 组合总和 II',
      status: 'locked',
      tasks: [
        { id: '39', title: '39. 组合总和', tag: '一刷必会', url: 'https://programmercarl.com/0039.组合总和.html', completed: false },
        { id: '40', title: '40. 组合总和 II', tag: '面试热点', url: 'https://programmercarl.com/0040.组合总和II.html', completed: false },
      ]
    }
  ],
  "数组": [
    {
      day: 1,
      topic: '数组：二分查找与移除元素',
      status: 'current',
      tasks: [
        { id: '704', title: '704. 二分查找', tag: '一刷必会', url: 'https://programmercarl.com/0704.二分查找.html', completed: false },
        { id: '27', title: '27. 移除元素', tag: '面试热点', url: 'https://programmercarl.com/0027.移除元素.html', completed: false },
      ]
    },
    {
      day: 2,
      topic: '数组：有序数组的平方与长度最小的子数组',
      status: 'locked',
      tasks: [
        { id: '977', title: '977. 有序数组的平方', tag: '一刷必会', url: 'https://programmercarl.com/0977.有序数组的平方.html', completed: false },
        { id: '209', title: '209. 长度最小的子数组', tag: '面试热点', url: 'https://programmercarl.com/0209.长度最小的子数组.html', completed: false },
      ]
    },
    {
      day: 3,
      topic: '数组：螺旋矩阵II',
      status: 'locked',
      tasks: [
        { id: '59', title: '59. 螺旋矩阵II', tag: '二刷深入', url: 'https://programmercarl.com/0059.螺旋矩阵II.html', completed: false },
      ]
    }
  ]
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDay, setCurrentDay] = useState(1);
  const [settings, setSettings] = useState<UserSettings>({
    dailyHours: 2,
    problemsPerDay: 3,
    startChapter: '回溯算法',
    startProblemId: '77',
    language: 'Python'
  });
  const [plan, setPlan] = useState<DayPlan[]>(CHAPTER_DATA['回溯算法']);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Resizing state
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(384);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  // System instruction updated with current settings
  const getDynamicInstruction = () => `你是一位顶级的算法训练营虚拟导师，由谷歌人工智能实验室构建，专为PC端交互设计。
当前学员设置：
- 主编程语言：${settings.language}
- 每日可用时长：${settings.dailyHours}小时
- 每日题量：${settings.problemsPerDay}题
- 刷题起点：${settings.startChapter} (从题目ID: ${settings.startProblemId} 开始)

你的核心任务是严格遵循“代码随想录”（programmercarl.com）的题目路线，辅助学员在40天内系统、扎实地完成一轮核心算法题训练。

你必须遵循以下原则和行为：
1. **规划（40天路线）**：以代码随想录官网左侧的默认刷题顺序为准。
2. **三问引导**：在答疑或讲解时，不要直接给出代码。先问思路，再问细节，最后引导学员写出代码。
3. **严格监督**：学员打卡时，必须要求提供笔记摘要，并对其进行评分（1-10分）。
4. **氛围营造**：保持专业、严谨但鼓励的语气。`;

  // Initial greeting
  useEffect(() => {
    const startApp = async () => {
      setIsLoading(true);
      try {
        const response = await getTutorResponse([], getDynamicInstruction());
        setMessages([{ role: 'model', content: response }]);
      } catch (error) {
        console.error("Failed to start tutor:", error);
      } finally {
        setIsLoading(false);
      }
    };
    startApp();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Resizing handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const newWidth = Math.max(200, Math.min(500, e.clientX));
        setLeftWidth(newWidth);
      }
      if (isResizingRight.current) {
        const newWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizingLeft = () => {
    isResizingLeft.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingRight = () => {
    isResizingRight.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = messages.concat(userMsg).map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      
      const response = await getTutorResponse(chatHistory, getDynamicInstruction());
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: "抱歉，我刚才走神了，请再说一遍？" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applySettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    setIsSettingsOpen(false);
    
    // Update plan based on chapter
    const fullChapterPlan = CHAPTER_DATA[newSettings.startChapter] || CHAPTER_DATA['数组'];
    
    // Find the day containing the startProblemId
    let startDayIdx = 0;
    fullChapterPlan.forEach((dayPlan, idx) => {
      if (dayPlan.tasks.some(t => t.id === newSettings.startProblemId)) {
        startDayIdx = idx;
      }
    });

    // Slice the plan to start from that day
    const newPlan = fullChapterPlan.slice(startDayIdx).map((p, i) => ({
      ...p,
      day: i + 1,
      status: i === 0 ? 'current' : 'locked' as any
    }));

    setPlan(newPlan);
    setCurrentDay(1);

    // Notify tutor about the change
    const notifyMsg = `【系统通知】学员调整了计划：
- 起点：${newSettings.startChapter} (从题目ID: ${newSettings.startProblemId} 开始)
- 每日时长：${newSettings.dailyHours}小时
- 每日题量：${newSettings.problemsPerDay}题
- 主语言：${newSettings.language}

请根据新计划重新生成前三天的学习建议。`;

    setIsLoading(true);
    try {
      const response = await getTutorResponse([], getDynamicInstruction() + "\n\n" + notifyMsg);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      console.error("Failed to update tutor after settings change:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (dayIdx: number, taskIdx: number) => {
    const newPlan = [...plan];
    newPlan[dayIdx].tasks[taskIdx].completed = !newPlan[dayIdx].tasks[taskIdx].completed;
    setPlan(newPlan);
  };

  const availableProblems = (CHAPTER_DATA[settings.startChapter] || []).flatMap(d => d.tasks);

  return (
    <div className="flex h-screen bg-[#0F1115] text-slate-200 font-sans overflow-hidden">
      {/* Sidebar: Progress */}
      <aside 
        style={{ width: `${leftWidth}px` }}
        className="border-r border-slate-800 bg-[#151921] flex flex-col relative"
      >
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Terminal size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate">算法冲刺营</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold truncate">Programmer Carl Edition</p>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">总体进度</span>
              <span className="text-xs font-mono text-blue-400">Day {currentDay}/40</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(currentDay / 40) * 100}%` }}
                className="h-full bg-blue-500"
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {Array.from({ length: 40 }).map((_, i) => {
            const dayNum = i + 1;
            const isCurrent = dayNum === currentDay;
            const isLocked = dayNum > currentDay + 2; // Mocking locked days
            
            return (
              <div 
                key={i}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer",
                  isCurrent ? "bg-blue-600/10 border border-blue-500/30" : "hover:bg-slate-800/50",
                  isLocked && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono border flex-shrink-0",
                  isCurrent ? "bg-blue-600 border-blue-400 text-white" : "border-slate-700 text-slate-500"
                )}>
                  {dayNum}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isCurrent ? "text-blue-400" : "text-slate-400"
                  )}>
                    {dayNum <= plan.length ? plan[dayNum-1]?.topic : `Day ${dayNum} 待解锁`}
                  </p>
                </div>
                {dayNum < currentDay && <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />}
              </div>
            );
          })}
        </nav>

        {/* Resizer Left */}
        <div 
          onMouseDown={startResizingLeft}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-10"
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0F1115]">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-[#151921]/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-400" />
            <span className="text-sm font-medium">2026年3月29日 · 星期日</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-500">导师在线</span>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors group"
              title="计划设置"
            >
              <LayoutDashboard size={20} className="text-slate-400 group-hover:text-blue-400" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          {/* Settings Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSettingsOpen(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative w-full max-w-md bg-[#151921] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
                >
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                        <LayoutDashboard size={20} />
                      </div>
                      <h2 className="text-xl font-bold">计划设置</h2>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">刷题起点 (章节)</label>
                          <select 
                            value={settings.startChapter}
                            onChange={(e) => {
                              const newChapter = e.target.value;
                              const firstProb = (CHAPTER_DATA[newChapter] || [])[0]?.tasks[0]?.id || '';
                              setSettings({...settings, startChapter: newChapter, startProblemId: firstProb});
                            }}
                            className="w-full bg-[#0F1115] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {CHAPTERS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">起始题目</label>
                          <select 
                            value={settings.startProblemId}
                            onChange={(e) => setSettings({...settings, startProblemId: e.target.value})}
                            className="w-full bg-[#0F1115] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {availableProblems.map(p => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">每日时长 (h)</label>
                          <input 
                            type="number" 
                            value={settings.dailyHours}
                            onChange={(e) => setSettings({...settings, dailyHours: Number(e.target.value)})}
                            className="w-full bg-[#0F1115] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">每日题量</label>
                          <input 
                            type="number" 
                            value={settings.problemsPerDay}
                            onChange={(e) => setSettings({...settings, problemsPerDay: Number(e.target.value)})}
                            className="w-full bg-[#0F1115] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">主编程语言</label>
                        <input 
                          type="text" 
                          value={settings.language}
                          onChange={(e) => setSettings({...settings, language: e.target.value})}
                          className="w-full bg-[#0F1115] border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Python, Java, C++..."
                        />
                      </div>
                    </div>

                    <div className="mt-10 flex gap-3">
                      <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm hover:bg-slate-800 transition-all"
                      >
                        取消
                      </button>
                      <button 
                        onClick={() => applySettings(settings)}
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
                      >
                        保存并重置计划
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Chat Section */}
          <section className="flex-1 flex flex-col border-r border-slate-800 relative">
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-4 max-w-[85%]",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md",
                      msg.role === 'user' ? "bg-slate-700" : "bg-blue-600"
                    )}>
                      {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                    </div>
                    <div className={cn(
                      "p-5 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.role === 'user' 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-[#1C212B] border border-slate-800 text-slate-300 rounded-tl-none"
                    )}>
                      <div className="markdown-body">
                        <ReactMarkdown 
                          components={{
                            a: ({node, ...props}) => <a {...props} className="text-blue-400 hover:underline flex items-center gap-1 inline-flex" target="_blank" rel="noopener noreferrer" />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex gap-4 mr-auto">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
                    <Bot size={20} />
                  </div>
                  <div className="bg-[#1C212B] border border-slate-800 p-4 rounded-2xl rounded-tl-none">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-[#151921]/80 backdrop-blur-md border-t border-slate-800">
              <div className="max-w-3xl mx-auto relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="输入你的心得、疑问或打卡摘要..."
                  className="w-full bg-[#0F1115] border border-slate-700 rounded-2xl px-5 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none h-20"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="absolute right-3 bottom-3 p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl transition-all shadow-lg shadow-blue-900/20"
                >
                  <Send size={20} />
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-500 mt-3 uppercase tracking-widest font-bold">
                Shift + Enter 换行 · Enter 发送
              </p>
            </div>
          </section>

          {/* Task Panel */}
          <section 
            style={{ width: `${rightWidth}px` }}
            className="bg-[#151921] flex flex-col relative"
          >
            {/* Resizer Right */}
            <div 
              onMouseDown={startResizingRight}
              className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-10"
            />

            <div className="p-6 border-b border-slate-800">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
                <BookOpen size={16} className="text-blue-400" />
                今日任务：Day {currentDay}
              </h2>
              <p className="text-xs text-slate-500">{plan[currentDay-1]?.topic}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {plan[currentDay-1]?.tasks.map((task, idx) => (
                <div 
                  key={task.id}
                  className={cn(
                    "p-4 rounded-xl border transition-all group",
                    task.completed 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-[#1C212B] border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      task.tag === '一刷必会' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                      task.tag === '面试热点' && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                      task.tag === '二刷深入' && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
                    )}>
                      {task.tag}
                    </span>
                    <button 
                      onClick={() => toggleTask(currentDay-1, idx)}
                      className={cn(
                        "w-5 h-5 rounded border transition-colors flex items-center justify-center",
                        task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-700 hover:border-blue-500"
                      )}
                    >
                      {task.completed && <CheckCircle2 size={14} />}
                    </button>
                  </div>
                  <h3 className={cn(
                    "text-sm font-medium mb-3",
                    task.completed ? "text-slate-500 line-through" : "text-slate-200"
                  )}>
                    {task.title}
                  </h3>
                  <a 
                    href={task.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    查看详解 <ExternalLink size={12} />
                  </a>
                </div>
              ))}

              <div className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy size={20} className="text-yellow-500" />
                  <span className="text-sm font-bold">导师寄语</span>
                </div>
                <p className="text-xs text-slate-400 italic leading-relaxed">
                  "数组是算法的基石。二分查找看似简单，但边界条件（左闭右闭 vs 左闭右开）是无数人的卡点。今天务必把这两个边界逻辑理清楚。"
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800">
              <button 
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                onClick={() => alert('请先在聊天窗口完成今日打卡对话！')}
              >
                完成今日打卡 <ChevronRight size={16} />
              </button>
            </div>
          </section>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
        .markdown-body pre {
          background: #0F1115 !important;
          border: 1px solid #1E293B;
          padding: 1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .markdown-body code {
          color: #93C5FD !important;
          font-family: 'JetBrains Mono', monospace;
          background: #1E293B;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.9em;
        }
        .markdown-body p {
          margin-bottom: 1rem;
        }
        .markdown-body ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .markdown-body li {
          margin-bottom: 0.25rem;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          color: white;
          font-weight: bold;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .markdown-body h1 { font-size: 1.5rem; }
        .markdown-body h2 { font-size: 1.25rem; }
        .markdown-body h3 { font-size: 1.1rem; }
        .markdown-body blockquote {
          border-left: 4px solid #3B82F6;
          padding-left: 1rem;
          color: #94A3B8;
          font-style: italic;
          margin: 1rem 0;
        }
      `}} />
    </div>
  );
}
