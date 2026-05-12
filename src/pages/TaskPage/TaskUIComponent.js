import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, Award, Zap, Users, Wallet, CheckSquare, BookOpen, PlayCircle, Send, Twitter, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { Progress } from "../../components/ui/progress.js";
import { useTelegram } from "../../reactContext/TelegramContext";
import { useReferral } from "../../reactContext/ReferralContext";
import { useNavigate } from "react-router-dom";
import { database } from "../../services/FirebaseConfig";
import { ref, onValue, runTransaction, update, get, set } from "firebase/database";
import { addHistoryLog } from "../../services/addHistory.js";

const BOT_TOKEN = process.env.REACT_APP_BOT_TOKEN;
export default function TasksPage() {
  const { user, scores } = useTelegram();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState({});
  const [userTasks, setUserTasks] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState("daily");
  const [buttonText, setButtonText] = useState({});
  
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoTimer, setVideoTimer] = useState(0);
  const [activeTask, setActiveTask] = useState(null);

  const [verifyTask, setVerifyTask] = useState(null);
  const [verifyCodeInput, setVerifyCodeInput] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const [newsCount, setNewsCount] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    let interval;
    if (selectedVideo && videoTimer > 0) {
      interval = setInterval(() => {
        setVideoTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [selectedVideo, videoTimer]);

  useEffect(() => {
    if (!userId) return;
    const tasksRef = ref(database, "tasks");
    const userTasksRef = ref(database, `connections/${userId}/tasks`);
    const newsRef = ref(database, `connections/${userId}/tasks/daily/news`);
    const gameRef = ref(database, `connections/${userId}/tasks/daily/game`);

    const unsubTasks = onValue(tasksRef, snap => {
      setTasks(snap.val() || {});
    });

    const unsubUserTasks = onValue(userTasksRef, snap => {
      setUserTasks(snap.val() || {});
    });

    const unsubNews = onValue(newsRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        const count = Object.keys(data).filter(k => !['claimed', 'claimedAt', 'completed', 'progress', 'lastUpdated'].includes(k)).length;
        setNewsCount(count);
      } else {
        setNewsCount(0);
      }
    });

    const unsubGame = onValue(gameRef, snap => {
      setGameCompleted(snap.exists() ? snap.val() === true || snap.val().completed === true : false);
    });

    return () => {
      unsubTasks();
      unsubUserTasks();
      unsubNews();
      unsubGame();
    };
  }, [userId]);

  const displayTaskScore = scores?.task_score || 0;

  const IconMap = useMemo(() => ({
    Zap: <Zap className="h-5 w-5 text-indigo-300" />,
    Award: <Award className="h-5 w-5 text-pink-300" />,
    Users: <Users className="h-5 w-5 text-amber-300" />,
    CheckSquare: <CheckSquare className="h-5 w-5 text-emerald-300" />,
    Wallet: <Wallet className="h-5 w-5 text-blue-300" />,
    BookOpen: <BookOpen className="h-5 w-5 text-blue-300" />,
    PlayCircle: <PlayCircle className="h-5 w-5 text-purple-300" />,
    Send: <Send className="h-5 w-5 text-blue-400" />,
    Twitter: <Twitter className="h-5 w-5 text-sky-400" />,
  }), []);

  const processedTasks = useMemo(() => {
    return Object.entries(tasks).flatMap(([category, catTasks]) =>
      Object.entries(catTasks || {}).map(([id, task]) => {
        let uTask = userTasks[category]?.[id];
        
        let completedProgress = 0;
        let isClaimed = false;
        
        if (typeof uTask === 'object' && uTask !== null) {
          completedProgress = uTask.progress || 0;
          isClaimed = uTask.claimed || false;
        }

        const totalReq = task.target || task.total || 1;

        if (task.type === 'news') {
          completedProgress = newsCount;
        } else if (task.type === 'game' && gameCompleted) {
          completedProgress = totalReq;
        }

        const isTaskCompleted = (typeof uTask === 'object' && uTask?.completed) || completedProgress >= totalReq;

        const iconKey = typeof task.icon === 'string'
          ? Object.keys(IconMap).find(k => k.toLowerCase() === task.icon.toLowerCase())
          : null;

        return {
          id,
          category,
          ...task,
          points: task.xp || task.score || task.points || 0,
          completed: completedProgress,
          isTaskCompleted: isTaskCompleted,
          total: totalReq,
          claimed: isClaimed,
          started: (typeof uTask === 'object' && uTask?.started) || false,
          icon: iconKey ? IconMap[iconKey] : (IconMap['Zap'] || <Zap className="h-5 w-5 text-indigo-300" />),
          iconBg: task.iconBg || "bg-indigo-500/30",
        };
      })
    );
  }, [tasks, userTasks, IconMap, newsCount, gameCompleted]);

  const dailyTasks = processedTasks.filter(t => t.category === "daily");
  const weeklyTasks = processedTasks.filter(t => t.category === "weekly");
  const achievements = processedTasks.filter(t => t.category === "achievements");

  const isTaskDone = (task) => {
    return task.claimed === true;
  };

  const handleDailyCompletionForWeekly = useCallback(async () => {
    if (dailyTasks.length === 0) return;

    const allCompleted = dailyTasks.every(task => task.isTaskCompleted);

    if (!allCompleted) return;

    const today = new Date().toDateString();
    let globalUpdateOccurred = false;

    const wTasks = tasks.weekly || {};
    for (const [weeklyTaskId, weeklyTask] of Object.entries(wTasks)) {
      if (weeklyTask.weeklyMode === "tracked") {
        const userWeeklyRef = ref(database, `connections/${userId}/tasks/weekly/${weeklyTaskId}`);
        const userWeeklySnap = await get(userWeeklyRef);
        const userData = userWeeklySnap.val() || {};

        if (userData.lastDailyCompleteDate === today) continue;

        const current = userData.progress || 0;
        const next = current + 1;

        await update(userWeeklyRef, {
          progress: next,
          completed: next >= weeklyTask.target,
          lastDailyCompleteDate: today,
          lastUpdated: Date.now()
        });
        
        globalUpdateOccurred = true;
      }
    }

    if (globalUpdateOccurred) {
      const lastDateRef = ref(database, `connections/${userId}/meta/lastDailyCompleteDate`);
      await set(lastDateRef, today);
    }
  }, [dailyTasks, tasks.weekly, userId]);

  useEffect(() => {
    if (dailyTasks.length > 0 && dailyTasks.every(task => task.isTaskCompleted)) {
      handleDailyCompletionForWeekly();
    }
  }, [dailyTasks, handleDailyCompletionForWeekly]);

  const fetchChatMember = async (chatId) => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
      const data = await response.json();
      return data.ok ? data.result : null;
    } catch (err) {
      return null;
    }
  };

  const handleChatId = async (url) => {
    if (!url) return { chatId: null };
    try {
      const match = url.match(/(?:t\.me|telegram\.me)\/([^/?]+)/);
      if (match && match[1]) return { chatId: `@${match[1]}` };
      return { chatId: null };
    } catch (err) {
      return { chatId: null };
    }
  };

  const startMembershipCheck = async (taskId, chatId, category) => {
    let checkCount = 0;
    const interval = setInterval(async () => {
      checkCount += 1;
      if (!chatId) {
        setButtonText(prev => ({ ...prev, [taskId]: "Failed" }));
        clearInterval(interval);
        return;
      }

      const chatMember = await fetchChatMember(chatId);
      if (chatMember && chatMember.status) {
        const isMember = ["member", "administrator", "creator"].includes(chatMember.status);
        if (isMember) {
          await update(ref(database, `connections/${userId}/tasks/${category}/${taskId}`), { 
            completed: true, 
            progress: 1 
          });
          setButtonText(prev => ({ ...prev, [taskId]: "Claim" }));
          clearInterval(interval);
          return;
        }
      }

      if (checkCount >= 100) {
        setButtonText(prev => ({ ...prev, [taskId]: "Failed" }));
        clearInterval(interval);
      }
    }, 3000);
  };

  const handleTitle = async (task, taskId) => {
    if (!userId) return;

    const isCompleted = task.isTaskCompleted;
    
    if (!isCompleted) {
      if (task.type === "watch") {
        if (!task.started) {
          await update(ref(database, `connections/${userId}/tasks/${task.category}/${taskId}`), {
            started: true,
            lastStartedAt: Date.now()
          });
          
          if (task.videoUrl) {
             setSelectedVideo(task.videoUrl);
             setVideoTimer(30);
             setActiveTask(task);
          } else if (task.url) {
             window.open(task.url, "_blank");
          }

          if (!task.watchCode) {
             await update(ref(database, `connections/${userId}/tasks/${task.category}/${taskId}`), {
               completed: true,
               progress: 1
             });
          }
          return;
        } else if (task.watchCode) {
          setVerifyTask(task);
          return;
        }
      } else if (task.type === "social") {
         setButtonText(prev => ({ ...prev, [taskId]: "Checking..." }));
         window.open(task.url, "_blank");
         const { chatId } = await handleChatId(task.url);
         startMembershipCheck(taskId, chatId, task.category);
         return;
      } else if (task.type === "news" || task.title.toLowerCase().includes("news")) {
         navigate("/news");
         return;
      } else if (task.type === "game" || task.title.toLowerCase().includes("game") || task.title.toLowerCase().includes("fruit ninja")) {
         navigate("/game");
         return;
      } else if (task.type === "partnership" || task.type === "referral") {
         navigate("/network");
         return;
      } else if (task.url) {
         window.open(task.url, "_blank");
         return;
      } else if (task.category === "weekly" && (task.title.toLowerCase().includes("daily") || task.description?.toLowerCase().includes("daily"))) {
         setActiveTab("daily");
         return;
      }
    }

    if (isCompleted && !task.claimed) {
      setButtonText(prev => ({ ...prev, [taskId]: "Processing..." }));
      try {
        const xp = Number(task.points || 0);
        const userScoreRef = ref(database, `users/${userId}/Score`);
        const snap = await get(userScoreRef);
        const s = snap.val() || {};

        await update(userScoreRef, {
          task_score: (s.task_score || 0) + xp,
          total_score: (s.total_score || 0) + xp
        });

        const userTaskRef = ref(database, `connections/${userId}/tasks/${task.category}/${taskId}`);

        if (task.category === "achievements") {
          await set(userTaskRef, {
            progress: 0,
            completed: false,
            claimed: false,
            lastUpdated: Date.now()
          });
        } else {
          await update(userTaskRef, { claimed: true, claimedAt: Date.now() });
        }

        if (task.category === "daily") {
          await handleDailyCompletionForWeekly();
        }

        addHistoryLog(userId, { action: `Task Reward: ${task.title}`, points: xp, type: task.type || 'task' });
        
        const clickBtn = document.getElementById(`clickBtn${taskId}`);
        if (clickBtn) clickBtn.style.display = "none";
      } catch (err) {
        console.error(err);
        setButtonText(prev => ({ ...prev, [taskId]: "Failed" }));
        setTimeout(() => setButtonText(prev => ({ ...prev, [taskId]: "Claim" })), 2000);
      }
    }
  };

  const filterTasks = filterType === "all"
    ? processedTasks
    : processedTasks.filter(task => task.type === filterType);



  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-indigo-600/90 via-purple-600/80 to-pink-600/90">
      {/* Background SVGs unchanged */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-purple-600/80 to-pink-600/90 z-0">
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" opacity="0.5" />
              </pattern>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <rect width="80" height="80" fill="url(#smallGrid)" />
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="1" opacity="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        {/* Floating shapes (unchanged) */}
        <div className="absolute top-[10%] left-[20%] w-20 h-20 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-20 blur-xl animate-float"></div>
        <div className="absolute top-[60%] right-[15%] w-24 h-24 bg-gradient-to-r from-purple-400 to-pink-400 opacity-20 blur-xl animate-float-delayed"></div>
        <div className="absolute bottom-[20%] left-[30%] w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-400 opacity-20 blur-xl animate-float-slow"></div>
        <div className="absolute inset-0 opacity-30">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            {[...Array(8)].map((_, i) => (
              <path key={i} d={`M0,${100 + i * 100} C150,${50 + i * 100} 250,${150 + i * 100} 400,${100 + i * 100}`} stroke="white" strokeWidth="0.5" fill="none" />
            ))}
          </svg>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden z-10">
        <header className="sticky top-0 z-10 bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={() => navigate("/")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-white">Tasks</h1>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm text-white">{displayTaskScore}</span>
              <Zap className="h-4 w-4 text-amber-300 fill-amber-300" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-auto">
          <div className="mb-6 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-white/80">Your Task Score</h3>
                <p className="text-2xl font-bold text-white">
                  {displayTaskScore} <span className="text-amber-300">XP</span>
                </p>
              </div>
              <div className="bg-white/10 rounded-full p-3">
                <CheckSquare className="h-6 w-6 text-amber-300" />
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="flex gap-4 bg-white/10 p-0.5 overflow-auto scroll-hidden">
              {["daily", "weekly", "achievements", "all", "watch", "social", "partnership", "misc"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="data-[state=active]:bg-white/20 text-white"
                  onClick={() => {
                    if (["all", "watch", "social", "partnership", "misc"].includes(tab)) {
                      setFilterType(tab);
                    }
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="daily" className="mt-4 space-y-3">
              {dailyTasks.map((task) => (
                <Card key={task.id} className="border-none shadow-md bg-white/10 backdrop-blur-md">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`${task.iconBg} p-2 rounded-full mt-1`}>{task.icon}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-white">{task.title}</h3>
                            <div className="flex flex-col">
                              <p className="text-xs text-white/70 mt-1">
                                {task.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge className="bg-amber-500/90 whitespace-nowrap">+{task.points} XP</Badge>
                            <button
                              className={`rounded text-white text-sm px-2 py-1 mt-1 whitespace-nowrap ${isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social' ? 'bg-gray-500 cursor-not-allowed' : 'bg-violet-500 hover:bg-violet-700'}`}
                              id={`clickBtn${task.id}`}
                              disabled={isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social'}
                              onClick={() => handleTitle(task, task.id)}
                            >
                              {isTaskDone(task)
                                ? (task.type === 'partnership' || task.type === 'social' ? "Open" : "Done")
                                : (
                                  task.isTaskCompleted
                                    ? "Claim"
                                    : (task.type === "watch" && task.started && task.watchCode ? "Enter Code" : (buttonText[task.id] || "Start Task"))
                                )
                              }
                            </button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-white/70 mb-1">
                            <span>Progress</span>
                            <span>{isTaskDone(task) || task.isTaskCompleted ? task.total : Math.min(task.completed, task.total)}/{task.total}</span>
                          </div>
                          <Progress value={isTaskDone(task) || task.isTaskCompleted ? 100 : (Math.min(task.completed, task.total) / task.total) * 100} className="h-1.5 bg-white/10" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="weekly" className="mt-4 space-y-3">
              {weeklyTasks.map((task) => (
                <Card key={task.id} className="border-none shadow-md bg-white/10 backdrop-blur-md">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`${task.iconBg} p-2 rounded-full mt-1`}>{task.icon}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-white">{task.title}</h3>
                            <p className="text-xs text-white/70 mt-1">{task.description}</p>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge className="bg-amber-500/90 whitespace-nowrap">+{task.points} XP</Badge>
                            <button
                              className={`rounded text-white text-sm px-2 py-1 mt-1 whitespace-nowrap ${isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social' ? 'bg-gray-500 cursor-not-allowed' : 'bg-violet-500 hover:bg-violet-700'}`}
                              id={`clickBtn${task.id}`}
                              disabled={isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social'}
                              onClick={() => handleTitle(task, task.id)}
                            >
                              {isTaskDone(task)
                                ? (task.type === 'partnership' || task.type === 'social' ? "Open" : "Done")
                                : (
                                  task.isTaskCompleted
                                    ? "Claim"
                                    : (task.type === "watch" && task.started && task.watchCode ? "Enter Code" : (buttonText[task.id] || "Start Task"))
                                )
                              }
                            </button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-white/70 mb-1">
                            <span>Progress</span>
                            <span>{isTaskDone(task) || task.isTaskCompleted ? task.total : Math.min(task.completed, task.total)}/{task.total}</span>
                          </div>
                          <Progress value={isTaskDone(task) || task.isTaskCompleted ? 100 : (Math.min(task.completed, task.total) / task.total) * 100} className="h-1.5 bg-white/10" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="achievements" className="mt-4 space-y-3">
              {achievements.map((task) => (
                <Card key={task.id} className="border-none shadow-md bg-white/10 backdrop-blur-md">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`${task.iconBg} p-2 rounded-full mt-1`}>{task.icon}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-white">{task.title}</h3>
                            <p className="text-xs text-white/70 mt-1">{task.description}</p>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge className="bg-amber-500/90 whitespace-nowrap">+{task.points} XP</Badge>
                            <button
                              className={`rounded text-white text-sm px-2 py-1 mt-1 whitespace-nowrap ${isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social' ? 'bg-gray-500 cursor-not-allowed' : 'bg-violet-500 hover:bg-violet-700'}`}
                              id={`clickBtn${task.id}`}
                              disabled={isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social'}
                              onClick={() => handleTitle(task, task.id)}
                            >
                              {isTaskDone(task)
                                ? (task.type === 'partnership' || task.type === 'social' ? "Open" : "Done")
                                : (
                                  task.isTaskCompleted
                                    ? "Claim"
                                    : (task.type === "watch" && task.started && task.watchCode ? "Enter Code" : (buttonText[task.id] || "Start Task"))
                                )
                              }
                            </button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-white/70 mb-1">
                            <span>Progress</span>
                            <span>{isTaskDone(task) || task.isTaskCompleted ? task.total : Math.min(task.completed, task.total)}/{task.total}</span>
                          </div>
                          <Progress value={isTaskDone(task) || task.isTaskCompleted ? 100 : (Math.min(task.completed, task.total) / task.total) * 100} className="h-1.5 bg-white/10" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value={filterType} className="mt-4 space-y-3">
              {filterTasks.map((task) => {
                const taskId = task.id;
                return (
                  <Card key={task.id} className="border-none shadow-md bg-white/10 backdrop-blur-md">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`${task.iconBg} p-2 rounded-full mt-1`}>{task.icon}</div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-white">{task.title}</h3>
                              <div className="flex flex-col">
                                <p className="text-xs text-white/70 mt-1">
                                  {task.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <Badge className="bg-amber-500/90 whitespace-nowrap">+{task.points} XP</Badge>
                              <button
                                className={`rounded text-white text-sm px-2 py-1 mt-1 whitespace-nowrap ${isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social' ? 'bg-gray-500 cursor-not-allowed' : 'bg-violet-500 hover:bg-violet-700'}`}
                                id={`clickBtn${taskId}`}
                                disabled={isTaskDone(task) && task.type !== 'partnership' && task.type !== 'social'}
                                onClick={() => handleTitle(task, taskId)}
                              >
                                {isTaskDone(task)
                                  ? (task.type === 'partnership' || task.type === 'social' ? "Open" : "Done")
                                  : (
                                      task.isTaskCompleted
                                      ? "Claim"
                                      : (task.type === "watch" && task.started && task.watchCode ? "Enter Code" : (buttonText[taskId] || "Start Task"))
                                  )
                                }
                              </button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-white/70 mb-1">
                              <span>Progress</span>
                              <span>{isTaskDone(task) || task.isTaskCompleted ? task.total : Math.min(task.completed, task.total)}/{task.total}</span>
                            </div>
                            <Progress
                              value={isTaskDone(task) || task.isTaskCompleted ? 100 : (Math.min(task.completed, task.total) / task.total) * 100}
                              className="h-1.5 bg-white/10"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </main>
      </div>
      {/* Video Modal Popup */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden w-full max-w-2xl shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
              <h3 className="text-white font-medium">Watch Video</h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black relative">
              <iframe
                src={selectedVideo.includes('youtube.com/watch?v=') ? selectedVideo.replace('watch?v=', 'embed/') : selectedVideo}
                className="absolute inset-0 w-full h-full"
                title="Task Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="p-4 flex justify-between items-center bg-white/5">
              <div className="text-white/70 text-sm">
                {videoTimer > 0 ? `Reward available in ${videoTimer}s` : "Review complete!"}
              </div>
              <button
                disabled={videoTimer > 0}
                onClick={async () => {
                  if (activeTask) {
                    const userTaskRef = ref(database, `connections/${user.id}/tasks/${activeTask.category}/${activeTask.id}`);
                    await update(userTaskRef, { completed: true, progress: 1 });
                  }
                  setSelectedVideo(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${videoTimer > 0
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
              >
                {videoTimer > 0 ? `Wait ${videoTimer}s` : "Claim Reward"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Code Modal Popup */}
      {verifyTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
              <h3 className="text-white font-medium">Enter Secret Code</h3>
              <button
                onClick={() => { setVerifyTask(null); setVerifyCodeInput(""); setVerifyError(""); }}
                className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-white/80 text-sm mb-4">
                Please enter the secret code shown in the video to complete this task.
              </p>
              <input
                type="text"
                value={verifyCodeInput}
                onChange={e => setVerifyCodeInput(e.target.value)}
                placeholder="Enter code here"
                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white mb-2 focus:outline-none focus:border-indigo-500"
              />
              {verifyError && <p className="text-red-400 text-xs mb-4">{verifyError}</p>}
              
              <Button
                onClick={async () => {
                  if (verifyCodeInput.trim().toLowerCase() === verifyTask.watchCode.trim().toLowerCase()) {
                    await update(ref(database, `connections/${userId}/tasks/${verifyTask.category}/${verifyTask.id}`), {
                      completed: true,
                      progress: 1
                    });
                    setVerifyTask(null);
                    setVerifyCodeInput("");
                    setVerifyError("");
                  } else {
                    setVerifyError("Wrong code. Please try again.");
                  }
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6"
              >
                Verify & Complete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
