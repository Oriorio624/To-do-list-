"use client"

import { useState, useRef, useEffect } from "react"
import { format, differenceInDays } from "date-fns"
import { CalendarIcon, Clock, Camera, ImagePlus, X, Settings, Edit2, Check, Sticker, RotateCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type Task = {
  id: string
  description: string
  deadline: Date
  status: "completed" | "not-completed"
  photo?: string
  isEditing?: boolean
}

type StatusOrder = {
  "not-completed": number
  completed: number
}

type TaskStatus = Task["status"]

type Theme = {
  primary: string
  secondary: string
  background: string
}

type Sticker = {
  id: string
  url: string
  position: { x: number; y: number }
  rotation: number
  scale: number
  size: { width: number; height: number }
  isActive?: boolean
}

const themes: Record<string, Theme> = {
  default: {
    primary: "from-purple-500 to-pink-500",
    secondary: "from-purple-50 via-pink-50 to-blue-50",
    background: "bg-white/80"
  },
  ocean: {
    primary: "from-blue-500 to-cyan-500",
    secondary: "from-blue-50 via-cyan-50 to-teal-50",
    background: "bg-white/80"
  },
  forest: {
    primary: "from-green-500 to-emerald-500",
    secondary: "from-green-50 via-emerald-50 to-teal-50",
    background: "bg-white/80"
  },
  sunset: {
    primary: "from-orange-500 to-red-500",
    secondary: "from-orange-50 via-red-50 to-pink-50",
    background: "bg-white/80"
  }
}

export default function TodoList() {
  // All hooks at the top, always called
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState("")
  const [newDeadline, setNewDeadline] = useState<Date | undefined>(undefined)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [newPhoto, setNewPhoto] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")
  const [sortBy, setSortBy] = useState<"deadline" | "status" | "none">("none")
  const [currentTheme, setCurrentTheme] = useState<string>("default")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [isDragging, setIsDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [resizeCorner, setResizeCorner] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null)
  const [isRotating, setIsRotating] = useState<string | null>(null)
  const [rotateStart, setRotateStart] = useState({ x: 0, y: 0, angle: 0 })
  const [activeSticker, setActiveSticker] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [stickerUrl, setStickerUrl] = useState("")
  const [isStickerDialogOpen, setIsStickerDialogOpen] = useState(false)
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/auth");
      } else {
        setUser(data.session.user);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/auth");
      } else {
        setUser(session.user);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    async function fetchTasks() {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('inserted_at', { ascending: true });
      if (error) {
        console.error(error);
      } else if (data) {
        setTasks(
          data.map((t: any) => ({
            ...t,
            deadline: t.deadline ? new Date(t.deadline) : undefined,
          }))
        );
      }
    }
    fetchTasks();
  }, []);

  useEffect(() => {
    async function fetchStickers() {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .order('inserted_at', { ascending: true });
      if (error) {
        console.error(error);
      } else if (data) {
        setStickers(
          data.map((s: any) => ({
            id: s.id,
            url: s.url,
            position: { x: s.position_x, y: s.position_y },
            rotation: s.rotation,
            scale: s.scale,
            size: { width: s.width, height: s.height }
          }))
        );
      }
    }
    fetchStickers();
  }, []);

  // Add new task to Supabase
  const addTask = async () => {
    if (newTask.trim() === "") return;
    const insertObj: any = {
      description: newTask,
      status: "not-completed",
      photo: newPhoto,
    };
    if (newDeadline) {
      insertObj.deadline = newDeadline.toISOString();
    }
    const { data, error } = await supabase
      .from('todos')
      .insert(insertObj)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    setTasks([
      ...tasks,
      { ...data, deadline: data.deadline ? new Date(data.deadline) : undefined }
    ]);
    setNewTask("");
    setNewDeadline(undefined);
    setNewPhoto(undefined);
  };

  // Update task status in Supabase
  const updateTaskStatus = async (id: string, status: TaskStatus) => {
    const { data, error } = await supabase
      .from('todos')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    setTasks(tasks.map((task) => (task.id === id ? { ...data, deadline: new Date(data.deadline) } : task)));
  };

  // Delete task in Supabase
  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id);
    if (error) {
      console.error(error);
      return;
    }
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "not-completed":
        return <span className="text-2xl">•</span>
      case "completed":
        return <span className="text-2xl">•</span>
    }
  }

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "not-completed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Not Completed
          </span>
        )
      case "completed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Completed
          </span>
        )
    }
  }

  const getDaysRemaining = (deadline: Date) => {
    const today = new Date()
    const days = differenceInDays(deadline, today)

    if (days < 0) return "Overdue"
    if (days === 0) return "Due today"
    if (days === 1) return "Tomorrow"
    return `${days} days left`
  }

  const getDeadlineColor = (deadline: Date) => {
    const days = differenceInDays(deadline, new Date())

    if (days < 0) return "text-red-600 font-semibold"
    if (days <= 2) return "text-amber-600 font-semibold"
    return "text-slate-600"
  }

  const handlePhotoCapture = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.capture = "environment"

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const photoUrl = e.target?.result as string
          setNewPhoto(photoUrl)
        }
        reader.readAsDataURL(file)
      }
    }

    input.click()
  }

  const handlePhotoUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const photoUrl = e.target?.result as string
          setNewPhoto(photoUrl)
        }
        reader.readAsDataURL(file)
      }
    }

    input.click()
  }

  const removePhoto = () => {
    setNewPhoto(undefined)
  }

  const filteredAndSortedTasks = tasks
    .filter((task: Task) => {
      const matchesSearch = task.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || task.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a: Task, b: Task) => {
      if (sortBy === "deadline") {
        return a.deadline.getTime() - b.deadline.getTime()
      }
      if (sortBy === "status") {
        const statusOrder: StatusOrder = { "not-completed": 0, completed: 1 }
        return statusOrder[a.status] - statusOrder[b.status]
      }
      return 0
    })

  // Calculate statistics
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.status === "completed").length
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const startEditing = (taskId: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, isEditing: true } : task
    ))
  }

  const saveEdit = (taskId: string, newDescription: string, newDeadline: Date) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, description: newDescription, deadline: newDeadline, isEditing: false } : task
    ))
  }

  const cancelEdit = (taskId: string) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, isEditing: false } : task
    ))
  }

  // Add sticker handling functions (with Supabase)
  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const img = new Image()
        img.onload = async () => {
          const aspectRatio = img.width / img.height
          const maxSize = 150
          let width = maxSize
          let height = maxSize / aspectRatio
          if (height > maxSize) {
            height = maxSize
            width = maxSize * aspectRatio
          }
          const newSticker = {
            url: e.target?.result as string,
            position: { x: 100, y: 100 },
            rotation: 0,
            scale: 1,
            size: { width, height }
          };
          const { data, error } = await supabase
            .from('stickers')
            .insert({
              url: newSticker.url,
              position_x: Math.round(newSticker.position.x),
              position_y: Math.round(newSticker.position.y),
              rotation: newSticker.rotation,
              scale: newSticker.scale,
              width: Math.round(newSticker.size.width),
              height: Math.round(newSticker.size.height),
            })
            .select()
            .single();
          if (error) {
            alert(error.message);
            return;
          }
          setStickers([...stickers, {
            ...newSticker,
            id: data.id
          }]);
          setIsStickerDialogOpen(false)
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUrlStickerAdd = async () => {
    if (stickerUrl) {
      const img = new Image()
      img.onload = async () => {
        const aspectRatio = img.width / img.height
        const maxSize = 150
        let width = maxSize
        let height = maxSize / aspectRatio
        if (height > maxSize) {
          height = maxSize
          width = maxSize * aspectRatio
        }
        const newSticker = {
          url: stickerUrl,
          position: { x: 100, y: 100 },
          rotation: 0,
          scale: 1,
          size: { width, height }
        };
        const { data, error } = await supabase
          .from('stickers')
          .insert({
            url: newSticker.url,
            position_x: Math.round(newSticker.position.x),
            position_y: Math.round(newSticker.position.y),
            rotation: newSticker.rotation,
            scale: newSticker.scale,
            width: Math.round(newSticker.size.width),
            height: Math.round(newSticker.size.height),
          })
          .select()
          .single();
        if (error) {
          alert(error.message);
          return;
        }
        setStickers([...stickers, {
          ...newSticker,
          id: data.id
        }]);
        setStickerUrl("")
        setIsStickerDialogOpen(false)
      }
      img.onerror = () => {
        alert("Invalid image URL. Please try again.")
      }
      img.src = stickerUrl
    }
  }

  // Update sticker in Supabase (position, size, rotation)
  const updateStickerInSupabase = async (sticker: Sticker) => {
    await supabase
      .from('stickers')
      .update({
        position_x: Math.round(sticker.position.x),
        position_y: Math.round(sticker.position.y),
        rotation: sticker.rotation,
        scale: sticker.scale,
        width: Math.round(sticker.size.width),
        height: Math.round(sticker.size.height),
      })
      .eq('id', sticker.id);
  };

  // Update sticker position/size/rotation in state and Supabase
  const handleStickerDrag = (e: React.MouseEvent) => {
    if (isDragging) {
      setStickers(stickers => stickers.map(sticker => {
        if (sticker.id === isDragging) {
          const updated = {
            ...sticker,
            position: {
              x: e.clientX - dragOffset.x,
              y: e.clientY - dragOffset.y
            }
          };
          updateStickerInSupabase(updated);
          return updated;
        }
        return sticker;
      }));
    }
  };

  const handleResize = (e: React.MouseEvent) => {
    if (isResizing && resizeCorner) {
      const dx = e.clientX - resizeStart.x
      const dy = e.clientY - resizeStart.y
      setStickers(stickers => stickers.map(sticker => {
        if (sticker.id === isResizing) {
          let newWidth = resizeStart.width
          let newHeight = resizeStart.height
          switch (resizeCorner) {
            case 'se':
              newWidth = Math.max(50, resizeStart.width + dx)
              newHeight = Math.max(50, resizeStart.height + dy)
              break
            case 'sw':
              newWidth = Math.max(50, resizeStart.width - dx)
              newHeight = Math.max(50, resizeStart.height + dy)
              break
            case 'ne':
              newWidth = Math.max(50, resizeStart.width + dx)
              newHeight = Math.max(50, resizeStart.height - dy)
              break
            case 'nw':
              newWidth = Math.max(50, resizeStart.width - dx)
              newHeight = Math.max(50, resizeStart.height - dy)
              break
          }
          // Maintain aspect ratio
          const aspectRatio = sticker.size.width / sticker.size.height
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = newWidth / aspectRatio
          } else {
            newWidth = newHeight * aspectRatio
          }
          const updated = {
            ...sticker,
            size: {
              width: Math.min(300, newWidth),
              height: Math.min(300, newHeight)
            }
          };
          updateStickerInSupabase(updated);
          return updated;
        }
        return sticker;
      }));
    }
  };

  const handleRotate = (e: React.MouseEvent) => {
    if (isRotating) {
      const angle = Math.atan2(e.clientY - rotateStart.y, e.clientX - rotateStart.x)
      const rotation = (angle * 180 / Math.PI) + 90 // Add 90 degrees to align with top
      setStickers(stickers => stickers.map(sticker => {
        if (sticker.id === isRotating) {
          const updated = {
            ...sticker,
            rotation: Math.round(rotation / 15) * 15 // Snap to 15-degree increments
          };
          updateStickerInSupabase(updated);
          return updated;
        }
        return sticker;
      }));
    }
  };

  // Delete sticker in Supabase
  const handleStickerDelete = async (id: string) => {
    await supabase
      .from('stickers')
      .delete()
      .eq('id', id);
    setStickers(stickers => stickers.filter(sticker => sticker.id !== id));
  };

  // Add sticker upload input ref
  const stickerInputRef = useRef<HTMLInputElement>(null)

  const handleResizeStart = (e: React.MouseEvent, id: string, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation()
    e.preventDefault()
    setIsResizing(id)
    setResizeCorner(corner)
    const sticker = stickers.find(s => s.id === id)
    if (sticker) {
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: sticker.size.width,
        height: sticker.size.height
      })
    }
  }

  const handleRotateStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    setIsRotating(id)
    const sticker = stickers.find(s => s.id === id)
    if (sticker) {
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
      setRotateStart({
        x: centerX,
        y: centerY,
        angle: sticker.rotation
      })
    }
  }

  const handleResizeEnd = () => {
    setIsResizing(null)
    setResizeCorner(null)
  }

  const handleRotateEnd = () => {
    setIsRotating(null)
  }

  const handleStickerClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (activeSticker === id) {
      // If clicking the same sticker, toggle editing mode
      setIsEditing(!isEditing)
    } else {
      // If clicking a different sticker, activate it and start editing
      setActiveSticker(id)
      setIsEditing(true)
    }
  }

  const handleBackgroundClick = () => {
    // Only deactivate if we're not currently dragging, resizing, or rotating
    if (!isDragging && !isResizing && !isRotating) {
      setActiveSticker(null)
      setIsEditing(false)
    }
  }

  // Start dragging a sticker
  const handleStickerDragStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsDragging(id);
    const sticker = stickers.find(s => s.id === id);
    if (sticker) {
      setDragOffset({
        x: e.clientX - sticker.position.x,
        y: e.clientY - sticker.position.y
      });
    }
  };

  // End dragging a sticker
  const handleStickerDragEnd = () => {
    setIsDragging(null);
  };

  // Only use conditionals in the return:
  return (
    !user ? (
      <div /> // or a spinner/loading
    ) : (
      <div
        className={cn(
          "min-h-screen bg-gradient-to-br p-3 md:p-6 relative select-none",
          isDarkMode ? "bg-gray-900" : themes[currentTheme].secondary
        )}
        onMouseMove={(e) => {
          if (isEditing) {
            handleStickerDrag(e)
            handleResize(e)
            handleRotate(e)
          }
        }}
        onMouseUp={() => {
          handleStickerDragEnd();
          handleResizeEnd();
          handleRotateEnd();
        }}
        onMouseLeave={() => {
          handleStickerDragEnd();
          handleResizeEnd();
          handleRotateEnd();
        }}
        onClick={handleBackgroundClick}
      >
        <div className="max-w-4xl mx-auto">
          <Card className={cn(
            "bg-gradient-to-r text-white border-0 shadow-lg",
            isDarkMode 
              ? "from-gray-800 to-gray-700" 
              : themes[currentTheme].primary
          )}>
            <CardHeader className="p-4 md:p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">My Tasks</h2>
                  <p className="text-white/80">
                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} total
                  </p>
                </div>
                <div className="flex gap-4">
                <div className="text-center">
                    <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
                    <p className="text-white/80">Completed</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'not-completed').length}</p>
                    <p className="text-white/80">Remaining</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      router.push("/auth");
                    }}
                    className={cn(
                      "ml-4 px-5 py-2 rounded-full font-semibold transition-colors",
                      isDarkMode
                        ? "bg-gradient-to-r from-gray-700 to-gray-500 text-white hover:from-gray-600 hover:to-gray-400"
                        : "bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 shadow-lg"
                    )}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="relative">
            <div className={cn(
              "mb-6 p-4 rounded-lg shadow-lg z-40",
              isDarkMode ? "bg-gray-800" : "bg-white"
            )}>
              <div className="space-y-4">
                <div className="space-y-3">
                  <Input
                    placeholder="✨ What needs to be done?"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    className={cn(
                      "text-base h-12 rounded-xl border-2 focus:border-purple-400 bg-white",
                      isDarkMode ? "border-gray-700 bg-gray-700 text-white" : "border-purple-200"
                    )}
                  />

                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal rounded-xl border-2 hover:border-purple-400 bg-white",
                          !newDeadline && "text-muted-foreground",
                          isDarkMode ? "border-gray-700 bg-gray-700 text-white" : "border-purple-200"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-5 w-5" />
                        {newDeadline ? format(newDeadline, "PPP") : "📅 Set a deadline"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newDeadline}
                        onSelect={(date) => {
                          setNewDeadline(date)
                          setIsCalendarOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoCapture}
                    className={cn(
                      "flex items-center gap-2 rounded-full border-2 h-10",
                      isDarkMode ? "border-gray-700 bg-gray-700 text-white hover:bg-gray-600" : "border-blue-200 hover:border-blue-400"
                    )}
                  >
                    <Camera className="h-4 w-4" />📸 Camera
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoUpload}
                    className={cn(
                      "flex items-center gap-2 rounded-full border-2 h-10",
                      isDarkMode ? "border-gray-700 bg-gray-700 text-white hover:bg-gray-600" : "border-blue-200 hover:border-blue-400"
                    )}
                  >
                    <ImagePlus className="h-4 w-4" />📁 Upload
                  </Button>
                  {newPhoto && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={removePhoto}
                      className={cn(
                        "flex items-center gap-2 rounded-full border-2 h-10",
                        isDarkMode ? "border-gray-700 bg-gray-700 text-white hover:bg-gray-600" : "border-red-200 hover:border-red-400"
                      )}
                    >
                      <X className="h-4 w-4" /> Remove Photo
                    </Button>
                  )}
                </div>

                <Button
                  onClick={addTask}
                  className={cn(
                    "w-full h-12 rounded-xl text-white font-medium",
                    isDarkMode 
                      ? "bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500"
                      : `bg-gradient-to-r ${themes[currentTheme].primary} hover:from-purple-600 hover:to-pink-600`
                  )}
                >
                  Add Task ✨
                </Button>
              </div>
            </div>

            <Card className={cn(
              "shadow-lg border-0 backdrop-blur-sm",
              isDarkMode ? "bg-gray-800" : themes[currentTheme].background
            )}>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3">
                  <Input
                    placeholder="🔍 Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-[200px] h-10 rounded-xl border-2 border-purple-200 focus:border-purple-400 bg-white"
                  />
                  <Select value={statusFilter} onValueChange={(value: TaskStatus | "all") => setStatusFilter(value)}>
                    <SelectTrigger className="w-[180px] h-10 rounded-xl border-2 border-purple-200 focus:border-purple-400 bg-white">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tasks</SelectItem>
                      <SelectItem value="not-completed">Not Completed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(value: "deadline" | "status" | "none") => setSortBy(value)}>
                    <SelectTrigger className="w-[180px] h-10 rounded-xl border-2 border-purple-200 focus:border-purple-400 bg-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Sorting</SelectItem>
                      <SelectItem value="deadline">Sort by Deadline</SelectItem>
                      <SelectItem value="status">Sort by Status</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </CardContent>
          </Card>

            <div className="space-y-4 z-40">
              {filteredAndSortedTasks.map((task: Task) => (
                <Card key={task.id} className={cn(
                  "shadow-lg border-0 backdrop-blur-sm hover:bg-white/90 transition-colors",
                  isDarkMode ? "bg-gray-800" : themes[currentTheme].background
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateTaskStatus(task.id, task.status === "completed" ? "not-completed" : "completed")}
                className={cn(
                        "h-8 w-8 p-0 rounded-full border-2",
                  task.status === "completed"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "border-gray-300 bg-white text-gray-400 hover:bg-gray-50"
                )}
              >
                        {task.status === "completed" ? "✓" : ""}
                      </Button>
                      <div className="flex-1">
                        {task.isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={task.description}
                              onChange={(e) => setTasks(tasks.map(t => 
                                t.id === task.id ? { ...t, description: e.target.value } : t
                              ))}
                              className="w-full"
                            />
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {format(task.deadline, "PPP")}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={task.deadline}
                                  onSelect={(date) => date && setTasks(tasks.map(t =>
                                    t.id === task.id ? { ...t, deadline: date } : t
                                  ))}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEdit(task.id, task.description, task.deadline)}
                                className="flex-1"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelEdit(task.id)}
                                className="flex-1"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(task.status)}
                              <span className={cn("font-medium", task.status === "completed" && "line-through text-gray-500")}>
                                {task.description}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(task.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                        </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className={cn(getDeadlineColor(task.deadline), task.status === "completed" && "line-through text-gray-500")}>
                                <Clock className="inline-block w-4 h-4 mr-1" />
                                {getDaysRemaining(task.deadline)}
                              </span>
                              {getStatusBadge(task.status)}
                        </div>
                        {task.photo && (
                                <div className="mt-2 relative inline-block">
                                  <img src={task.photo} alt="Task" className="h-20 w-20 object-cover rounded-lg" />
                            </div>
                          )}
                          </>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTask(task.id)}
                          className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="absolute inset-0 pointer-events-none z-10">
              {stickers.map((sticker) => (
                <div
                  key={sticker.id}
                  className={cn(
                    "absolute pointer-events-auto",
                    activeSticker === sticker.id ? "z-20" : "z-10"
                  )}
                  style={{
                    left: sticker.position.x,
                    top: sticker.position.y,
                    transform: `rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                    width: sticker.size.width,
                    height: sticker.size.height,
                    cursor: isEditing && activeSticker === sticker.id ? "move" : "pointer"
                  }}
                  onClick={(e) => handleStickerClick(e, sticker.id)}
                  { ...(isEditing && activeSticker === sticker.id ? { onMouseDown: (e) => handleStickerDragStart(e, sticker.id) } : {}) }
                >
                  <div className="relative group">
                    <img
                      src={sticker.url}
                      alt="Sticker"
                      style={{
                        width: sticker.size.width,
                        height: sticker.size.height,
                        objectFit: 'contain'
                      }}
                      draggable={false}
                      className="select-none"
                    />
                    {isEditing && activeSticker === sticker.id && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute -top-8 right-0 h-6 w-6 p-0 rounded-full opacity-100 transition-opacity select-none shadow-md"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStickerDelete(sticker.id)
                        }}
                      >
                        ×
                      </Button>
                    )}
                    {isEditing && activeSticker === sticker.id && (
                      <div 
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white border-2 border-blue-500 rounded-full cursor-grab select-none flex items-center justify-center opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          handleRotateStart(e, sticker.id)
                        }}
                      >
                        <RotateCw className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                    {isEditing && activeSticker === sticker.id && (
                      <>
                        <div 
                          className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nw-resize select-none"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, sticker.id, 'nw')
                          }}
                        />
                        <div 
                          className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-ne-resize select-none"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, sticker.id, 'ne')
                          }}
                        />
                        <div 
                          className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-sw-resize select-none"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, sticker.id, 'sw')
                          }}
                        />
                        <div 
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-se-resize select-none"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, sticker.id, 'se')
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-6 right-6 flex gap-2 z-50">
          <input
            type="file"
            ref={stickerInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleStickerUpload}
          />
          <Dialog open={isStickerDialogOpen} onOpenChange={setIsStickerDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-full shadow-lg z-50",
                  isDarkMode 
                    ? "bg-gray-800 text-white hover:bg-gray-700" 
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                <Sticker className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className={cn(
              "sm:max-w-[425px]",
              isDarkMode ? "bg-gray-800 text-white" : "bg-white"
            )}>
              <DialogHeader>
                <DialogTitle>Add Sticker</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sticker-url">Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sticker-url"
                      placeholder="Enter image URL"
                      value={stickerUrl}
                      onChange={(e) => setStickerUrl(e.target.value)}
                      className={cn(
                        "flex-1",
                        isDarkMode ? "bg-gray-700 border-gray-600" : ""
                      )}
                    />
                    <Button
                      onClick={handleUrlStickerAdd}
                      disabled={!stickerUrl}
                      className={cn(
                        "bg-gradient-to-r",
                        isDarkMode 
                          ? "from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500"
                          : themes[currentTheme].primary
                      )}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className={cn(
                      "bg-background px-2",
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      Or
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => stickerInputRef.current?.click()}
                  className={cn(
                    "w-full",
                    isDarkMode ? "border-gray-700 hover:bg-gray-700" : ""
                  )}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Upload Image
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-full shadow-lg z-50",
                  isDarkMode 
                    ? "bg-gray-800 text-white hover:bg-gray-700" 
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                <Settings className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className={cn(
              "sm:max-w-[425px]",
              isDarkMode ? "bg-gray-800 text-white" : "bg-white"
            )}>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <Switch
                    id="dark-mode"
                    checked={isDarkMode}
                    onCheckedChange={setIsDarkMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(themes).map(([name, theme]) => (
                      <Button
                        key={name}
                        variant="outline"
                        className={cn(
                          "h-20 bg-gradient-to-r",
                          theme.primary,
                          currentTheme === name && "ring-2 ring-offset-2 ring-purple-500"
                        )}
                        onClick={() => setCurrentTheme(name)}
                      >
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  )
}
