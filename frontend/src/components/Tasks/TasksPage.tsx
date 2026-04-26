import { useState } from 'react';
import { Droplets, Sprout, Scissors, Bug, Sun, CloudRain, Snowflake, CheckSquare, Square } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'water' | 'fertilize' | 'prune' | 'pest' | 'general';
  season?: string;
  done: boolean;
}

const SEASON_TASKS: Task[] = [
  // ฤดูร้อน
  { id: '1', title: 'รดน้ำต้นไม้เพิ่มความถี่', description: 'ฤดูร้อน ต้นไม้ต้องการน้ำมากขึ้น ควรรดน้ำ 2 ครั้ง/วัน เช้า-เย็น', priority: 'high', category: 'water', season: 'ฤดูร้อน', done: false },
  { id: '2', title: 'คลุมโคนต้นด้วยฟางหรือใบไม้แห้ง', description: 'ช่วยรักษาความชื้นในดินและลดอุณหภูมิรอบรากต้นไม้', priority: 'high', category: 'general', season: 'ฤดูร้อน', done: false },
  { id: '3', title: 'ย้ายกระถางออกจากแดดจัด', description: 'ต้นไม้กระถางควรย้ายเข้าร่มในช่วงบ่ายที่อากาศร้อนจัด', priority: 'medium', category: 'general', season: 'ฤดูร้อน', done: false },

  // ฤดูฝน
  { id: '4', title: 'ระวังโรครากเน่า', description: 'ฤดูฝน น้ำขังทำให้รากเน่า ควรตรวจสอบการระบายน้ำและยกกระถางขึ้น', priority: 'high', category: 'pest', season: 'ฤดูฝน', done: false },
  { id: '5', title: 'ใส่ปุ๋ยอินทรีย์หลังฝนตก', description: 'ฝนตกแล้วดินชื้น เป็นเวลาที่ดีที่สุดสำหรับการใส่ปุ๋ย', priority: 'medium', category: 'fertilize', season: 'ฤดูฝน', done: false },
  { id: '6', title: 'กำจัดวัชพืชรอบต้น', description: 'ฤดูฝนวัชพืชงอกเร็ว ควรถอนทุก 2 สัปดาห์', priority: 'medium', category: 'general', season: 'ฤดูฝน', done: false },
  { id: '7', title: 'พ่นสารป้องกันเชื้อรา', description: 'ฤดูฝนมีความชื้นสูง เชื้อราระบาดง่าย ควรพ่นสารป้องกันทุก 2 สัปดาห์', priority: 'high', category: 'pest', season: 'ฤดูฝน', done: false },

  // ฤดูหนาว
  { id: '8', title: 'ลดการรดน้ำ', description: 'อากาศเย็น ความชื้นระเหยช้า ควรลดการรดน้ำเหลือ 1 ครั้ง/2 วัน', priority: 'medium', category: 'water', season: 'ฤดูหนาว', done: false },
  { id: '9', title: 'ตัดแต่งกิ่งต้นไม้', description: 'ช่วงต้นฤดูหนาวเหมาะสำหรับการตัดแต่งกิ่ง เพื่อให้ต้นไม้แตกยอดใหม่ในฤดูร้อน', priority: 'high', category: 'prune', season: 'ฤดูหนาว', done: false },
  { id: '10', title: 'ใส่ปุ๋ยสูตรเร่งดอก', description: 'ต้นไม้หลายชนิดออกดอกในฤดูหนาว ควรใส่ปุ๋ยสูตร 0-52-34', priority: 'medium', category: 'fertilize', season: 'ฤดูหนาว', done: false },

  // ทั่วไป
  { id: '11', title: 'ตรวจสอบแมลงศัตรูพืช', description: 'ตรวจดูใบไม้ทั้งด้านบนและล่าง มองหาเพลี้ย ไรแมงมุม หรือหนอน', priority: 'high', category: 'pest', season: 'ตลอดปี', done: false },
  { id: '12', title: 'ใส่ปุ๋ยชีวภาพ (EM)', description: 'ราดดินรอบโคนต้นด้วยน้ำหมัก EM ทุกเดือน เพื่อเพิ่มจุลินทรีย์ที่มีประโยชน์', priority: 'low', category: 'fertilize', season: 'ตลอดปี', done: false },
  { id: '13', title: 'เปลี่ยนดินกระถาง', description: 'ต้นไม้กระถางที่ปลูกมา 1-2 ปี ควรเปลี่ยนดินใหม่เพื่อเพิ่มธาตุอาหาร', priority: 'low', category: 'general', season: 'ตลอดปี', done: false },
  { id: '14', title: 'ล้างใบไม้ด้วยน้ำสะอาด', description: 'ล้างฝุ่นและคราบออกจากใบ ช่วยให้ใบสังเคราะห์แสงได้ดีขึ้น', priority: 'low', category: 'general', season: 'ตลอดปี', done: false },
  { id: '15', title: 'ตรวจสอบรากที่โผล่พ้นกระถาง', description: 'หากรากโผล่ออกมาจากรูระบายน้ำ ให้เปลี่ยนกระถางที่ใหญ่กว่า', priority: 'medium', category: 'general', season: 'ตลอดปี', done: false },
];

const categoryConfig = {
  water: { icon: <Droplets size={16} />, label: 'รดน้ำ', color: 'blue' },
  fertilize: { icon: <Sprout size={16} />, label: 'ใส่ปุ๋ย', color: 'green' },
  prune: { icon: <Scissors size={16} />, label: 'ตัดแต่งกิ่ง', color: 'purple' },
  pest: { icon: <Bug size={16} />, label: 'กำจัดศัตรูพืช', color: 'red' },
  general: { icon: <Sun size={16} />, label: 'ทั่วไป', color: 'amber' },
};

const priorityConfig = {
  high: { label: 'สำคัญมาก', bg: 'bg-red-100 text-red-700' },
  medium: { label: 'ปานกลาง', bg: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'ไม่เร่งด่วน', bg: 'bg-gray-100 text-gray-600' },
};

const seasonIcon = {
  'ฤดูร้อน': <Sun size={14} />,
  'ฤดูฝน': <CloudRain size={14} />,
  'ฤดูหนาว': <Snowflake size={14} />,
  'ตลอดปี': <Sprout size={14} />,
};

const currentMonth = new Date().getMonth() + 1;
const currentSeason =
  currentMonth >= 3 && currentMonth <= 5 ? 'ฤดูร้อน' :
  currentMonth >= 6 && currentMonth <= 10 ? 'ฤดูฝน' : 'ฤดูหนาว';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS_WITH_SEASON());
  const [filterSeason, setFilterSeason] = useState<string>('ทั้งหมด');
  const [filterCategory, setFilterCategory] = useState<string>('ทั้งหมด');

  function SEED_TASKS_WITH_SEASON() {
    return SEASON_TASKS.map((t) => ({ ...t }));
  }

  const toggleDone = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const seasons = ['ทั้งหมด', 'ฤดูร้อน', 'ฤดูฝน', 'ฤดูหนาว', 'ตลอดปี'];
  const categories = ['ทั้งหมด', ...Object.keys(categoryConfig)];

  const filtered = tasks.filter((t) => {
    const s = filterSeason === 'ทั้งหมด' || t.season === filterSeason;
    const c = filterCategory === 'ทั้งหมด' || t.category === filterCategory;
    return s && c;
  });

  const done = filtered.filter((t) => t.done).length;

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="bg-forest-700 text-white rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold mb-1">งานดูแลต้นไม้ที่แนะนำ 🌿</h2>
            <p className="text-forest-200 text-sm">ขณะนี้อยู่ใน<strong className="text-white"> {currentSeason}</strong> — ดูงานที่ควรทำในช่วงนี้</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{done}/{filtered.length}</p>
            <p className="text-forest-300 text-xs">งานที่ทำแล้ว</p>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-3 bg-forest-800 rounded-full h-2">
          <div
            className="bg-forest-300 h-2 rounded-full transition-all"
            style={{ width: filtered.length > 0 ? `${(done / filtered.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1.5 font-medium">ฤดูกาล</p>
          <div className="flex gap-1.5 flex-wrap">
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeason(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  filterSeason === s
                    ? 'bg-forest-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-forest-100'
                } ${s === currentSeason ? 'ring-2 ring-forest-400' : ''}`}
              >
                {s !== 'ทั้งหมด' && seasonIcon[s as keyof typeof seasonIcon]}
                {s}
                {s === currentSeason && <span className="text-xs opacity-70">(ตอนนี้)</span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1.5 font-medium">ประเภท</p>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilterCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterCategory === c
                    ? 'bg-forest-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-forest-100'
                }`}
              >
                {c === 'ทั้งหมด' ? 'ทั้งหมด' : categoryConfig[c as keyof typeof categoryConfig].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((task) => {
          const cat = categoryConfig[task.category];
          const pri = priorityConfig[task.priority];
          return (
            <div
              key={task.id}
              onClick={() => toggleDone(task.id)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                task.done ? 'opacity-60 border-gray-200' : 'border-gray-100 hover:border-forest-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {task.done
                    ? <CheckSquare size={20} className="text-forest-500" />
                    : <Square size={20} className="text-gray-300" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-sm font-semibold ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pri.bg}`}>
                      {pri.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{task.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600`}>
                      {cat.icon} {cat.label}
                    </span>
                    {task.season && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        {seasonIcon[task.season as keyof typeof seasonIcon]} {task.season}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Sprout size={48} className="mx-auto mb-3 opacity-30" />
          <p>ไม่มีงานในตัวกรองนี้</p>
        </div>
      )}
    </div>
  );
}
