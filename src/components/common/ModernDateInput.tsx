import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Globe,
  Sparkles,
  X
} from 'lucide-react';
import {
  formatDateByCalendar,
  toEthiopianDate,
  toGregorianDate,
  ETHIOPIAN_MONTHS,
  EthiopianDate
} from '../../lib/ethiopianCalendar';
import { triggerHaptic } from '../../lib/haptics';

export interface ModernDateInputProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'date' | 'datetime-local';
  label?: string;
  sublabel?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  calendarType?: 'ETHIOPIAN' | 'GREGORIAN';
  showCalendarAlt?: boolean;
  accentColor?: 'emerald' | 'indigo' | 'purple' | 'blue' | 'amber' | 'teal';
  presets?: Array<{ label: string; value: string }>;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
}

const GREGORIAN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const GREGORIAN_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const ETHIOPIAN_DAYS = ['እሁ', 'ሰኞ', 'ማክ', 'ረቡ', 'ሐሙ', 'አር', 'ቅዳ'];

export const ModernDateInput: React.FC<ModernDateInputProps> = ({
  value,
  onChange,
  type = 'date',
  label,
  sublabel,
  min,
  max,
  required = false,
  disabled = false,
  className = '',
  placeholder,
  calendarType: defaultCalendarType = 'GREGORIAN',
  showCalendarAlt = true,
  accentColor = 'emerald',
  presets,
  helperText,
  size = 'md',
  id
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Popover state
  const [isOpen, setIsOpen] = useState(false);
  const [activeCalType, setActiveCalType] = useState<'ETHIOPIAN' | 'GREGORIAN'>(defaultCalendarType);

  useEffect(() => {
    setActiveCalType(defaultCalendarType);
  }, [defaultCalendarType]);

  // Selected date components
  const parsedDate = useMemo(() => {
    if (!value) return new Date();
    const d = new Date(type === 'datetime-local' ? value : `${value}T12:00:00.000Z`);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value, type]);

  // Active view date for navigation
  const [viewGregDate, setViewGregDate] = useState<Date>(() => parsedDate);
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (type === 'datetime-local' && value && value.includes('T')) {
      return value.split('T')[1].substring(0, 5);
    }
    return '12:00';
  });

  // Sync view date whenever popover opens or value changes
  useEffect(() => {
    if (isOpen) {
      setViewGregDate(parsedDate);
      if (type === 'datetime-local' && value && value.includes('T')) {
        setSelectedTime(value.split('T')[1].substring(0, 5));
      }
    }
  }, [isOpen, parsedDate, type, value]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Color schemes
  const colorMap = {
    emerald: {
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-[#00D4AA] border-emerald-500/20',
      activeBorder: 'border-emerald-500 dark:border-[#00D4AA] ring-2 ring-emerald-500/20',
      presetActive: 'bg-emerald-600 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A]',
      selectedDay: 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30',
      todayRing: 'ring-1.5 ring-emerald-500/80 text-emerald-600 dark:text-[#00D4AA] font-bold',
      icon: 'text-emerald-600 dark:text-[#00D4AA]',
      accentBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    },
    indigo: {
      badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      activeBorder: 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20',
      presetActive: 'bg-indigo-600 dark:bg-indigo-500 text-white',
      selectedDay: 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30',
      todayRing: 'ring-1.5 ring-indigo-500/80 text-indigo-600 dark:text-indigo-400 font-bold',
      icon: 'text-indigo-600 dark:text-indigo-400',
      accentBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white'
    },
    purple: {
      badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      activeBorder: 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/20',
      presetActive: 'bg-purple-600 dark:bg-purple-500 text-white',
      selectedDay: 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30',
      todayRing: 'ring-1.5 ring-purple-500/80 text-purple-600 dark:text-purple-400 font-bold',
      icon: 'text-purple-600 dark:text-purple-400',
      accentBtn: 'bg-purple-600 hover:bg-purple-700 text-white'
    },
    blue: {
      badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      activeBorder: 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20',
      presetActive: 'bg-blue-600 dark:bg-blue-500 text-white',
      selectedDay: 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30',
      todayRing: 'ring-1.5 ring-blue-500/80 text-blue-600 dark:text-blue-400 font-bold',
      icon: 'text-blue-600 dark:text-blue-400',
      accentBtn: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    amber: {
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      activeBorder: 'border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/20',
      presetActive: 'bg-amber-600 dark:bg-amber-500 text-white',
      selectedDay: 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30',
      todayRing: 'ring-1.5 ring-amber-500/80 text-amber-600 dark:text-amber-400 font-bold',
      icon: 'text-amber-600 dark:text-amber-400',
      accentBtn: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    teal: {
      badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      activeBorder: 'border-teal-500 dark:border-teal-400 ring-2 ring-teal-500/20',
      presetActive: 'bg-teal-600 dark:bg-teal-500 text-white',
      selectedDay: 'bg-teal-600 text-white font-bold shadow-md shadow-teal-600/30',
      todayRing: 'ring-1.5 ring-teal-500/80 text-teal-600 dark:text-teal-400 font-bold',
      icon: 'text-teal-600 dark:text-teal-400',
      accentBtn: 'bg-teal-600 hover:bg-teal-700 text-white'
    }
  }[accentColor];

  // Derive human-readable relative label or Ethiopian date preview
  let relativeBadge = '';
  let altCalendarStr = '';

  if (value) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(parsedDate);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

      if (diffDays === 0) relativeBadge = 'Today';
      else if (diffDays === -1) relativeBadge = 'Yesterday';
      else if (diffDays === 1) relativeBadge = 'Tomorrow';
      else if (diffDays > 1 && diffDays <= 7) relativeBadge = `In ${diffDays} days`;
      else if (diffDays < -1 && diffDays >= -7) relativeBadge = `${Math.abs(diffDays)}d ago`;

      if (showCalendarAlt) {
        altCalendarStr = formatDateByCalendar(parsedDate.toISOString(), activeCalType === 'ETHIOPIAN' ? 'ETHIOPIAN' : 'GREGORIAN', false);
      }
    } catch {
      // Ignore
    }
  }

  // Handle selecting a specific date
  const handleSelectDate = (d: Date) => {
    triggerHaptic('light');
    const yStr = String(d.getFullYear()).padStart(4, '0');
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');

    if (type === 'datetime-local') {
      const timePart = selectedTime || '12:00';
      onChange(`${yStr}-${mStr}-${dStr}T${timePart}`);
    } else {
      onChange(`${yStr}-${mStr}-${dStr}`);
      setIsOpen(false);
    }
  };

  // Handle time change for datetime-local
  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime);
    if (value) {
      const datePart = value.split('T')[0];
      onChange(`${datePart}T${newTime}`);
    }
  };

  // Quick Today jump
  const handleJumpToday = () => {
    triggerHaptic('medium');
    const now = new Date();
    setViewGregDate(now);
    handleSelectDate(now);
  };

  // Month navigation
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (activeCalType === 'ETHIOPIAN') {
      const eth = toEthiopianDate(viewGregDate);
      let newYear = eth.year;
      let newMonth = eth.month - 1;
      if (newMonth < 1) {
        newMonth = 13;
        newYear -= 1;
      }
      setViewGregDate(toGregorianDate(newYear, newMonth, 1));
    } else {
      setViewGregDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (activeCalType === 'ETHIOPIAN') {
      const eth = toEthiopianDate(viewGregDate);
      let newYear = eth.year;
      let newMonth = eth.month + 1;
      if (newMonth > 13) {
        newMonth = 1;
        newYear += 1;
      }
      setViewGregDate(toGregorianDate(newYear, newMonth, 1));
    } else {
      setViewGregDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  // Compute calendar grid data
  const calendarGrid = useMemo(() => {
    const today = new Date();
    const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedYMD = value ? value.split('T')[0] : '';

    if (activeCalType === 'ETHIOPIAN') {
      const currentEth = toEthiopianDate(viewGregDate);
      const ey = currentEth.year;
      const em = currentEth.month;
      const daysInMonth = em === 13 ? (ey % 4 === 3 ? 6 : 5) : 30;

      // First day of Ethiopian month converted to Gregorian to get day of week (0 = Sun, 6 = Sat)
      const firstDayGreg = toGregorianDate(ey, em, 1);
      const startDayOfWeek = firstDayGreg.getDay(); // 0 is Sunday

      const days = [];
      // Empty leading slots
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push({ key: `blank-${i}`, isBlank: true });
      }

      // Days in Ethiopian month
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const gregEquivalent = toGregorianDate(ey, em, dayNum);
        const ymd = `${gregEquivalent.getFullYear()}-${String(gregEquivalent.getMonth() + 1).padStart(2, '0')}-${String(gregEquivalent.getDate()).padStart(2, '0')}`;
        const isSelected = ymd === selectedYMD;
        const isToday = ymd === todayYMD;

        days.push({
          key: `eth-${dayNum}`,
          isBlank: false,
          dayNumber: dayNum,
          gregDate: gregEquivalent,
          isSelected,
          isToday
        });
      }

      const mMeta = ETHIOPIAN_MONTHS[em - 1] || ETHIOPIAN_MONTHS[0];
      return {
        headerTitle: `${mMeta.am} (${mMeta.en}) ${ey} E.C.`,
        days,
        dayLabels: ETHIOPIAN_DAYS
      };
    } else {
      // Gregorian
      const gy = viewGregDate.getFullYear();
      const gm = viewGregDate.getMonth(); // 0-indexed
      const daysInMonth = new Date(gy, gm + 1, 0).getDate();
      const startDayOfWeek = new Date(gy, gm, 1).getDay();

      const days = [];
      // Empty leading slots
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push({ key: `blank-${i}`, isBlank: true });
      }

      // Month days
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const d = new Date(gy, gm, dayNum);
        const ymd = `${gy}-${String(gm + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const isSelected = ymd === selectedYMD;
        const isToday = ymd === todayYMD;

        days.push({
          key: `greg-${dayNum}`,
          isBlank: false,
          dayNumber: dayNum,
          gregDate: d,
          isSelected,
          isToday
        });
      }

      return {
        headerTitle: `${GREGORIAN_MONTHS[gm]} ${gy} G.C.`,
        days,
        dayLabels: GREGORIAN_DAYS
      };
    }
  }, [activeCalType, viewGregDate, value]);

  const paddingClasses = size === 'sm' ? 'p-2' : size === 'lg' ? 'p-3.5' : 'p-2.5';

  return (
    <div ref={containerRef} className={`relative space-y-1.5 select-none ${className}`}>
      {/* Label and Quick Presets Header */}
      {(label || (presets && presets.length > 0)) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {label && (
            <label className="text-[11px] font-bold text-slate-700 dark:text-[#8899BB] flex items-center gap-1.5 uppercase tracking-wide">
              {type === 'datetime-local' ? <Clock className={`w-3.5 h-3.5 ${colorMap.icon}`} /> : <CalendarIcon className={`w-3.5 h-3.5 ${colorMap.icon}`} />}
              <span>{label}</span>
              {required && <span className="text-rose-500">*</span>}
            </label>
          )}

          {presets && presets.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {presets.map((preset) => {
                const isActive = value === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(preset.value);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? colorMap.presetActive
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1E2D40]/60 dark:hover:bg-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Interactive Box: Clicking ANYWHERE in this container opens the modern date calendar */}
      <div
        onClick={() => {
          if (!disabled) {
            triggerHaptic('light');
            setIsOpen((prev) => !prev);
          }
        }}
        className={`group relative rounded-xl border bg-white dark:bg-[#0A0E1A] hover:bg-slate-50/90 dark:hover:bg-[#131926] transition-all cursor-pointer shadow-sm ${paddingClasses} ${
          isOpen
            ? colorMap.activeBorder
            : 'border-slate-200 dark:border-[#1E2D40] hover:border-slate-300 dark:hover:border-slate-700'
        } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        title="Click anywhere to choose date"
      >
        <div className="flex items-center gap-2.5">
          {/* Calendar Icon Micro-Badge */}
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${colorMap.badge}`}
          >
            {type === 'datetime-local' ? (
              <Clock className="w-3.5 h-3.5" />
            ) : (
              <CalendarIcon className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Formatted Date Display */}
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white tracking-wide truncate">
              {value ? (
                type === 'datetime-local' ? (
                  <span>
                    {value.replace('T', ' ')}
                  </span>
                ) : (
                  <span>
                    {value}
                  </span>
                )
              ) : (
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  {placeholder || (type === 'datetime-local' ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD')}
                </span>
              )}
            </div>

            {/* Sub-label, Relative Badge and Ethiopian Calendar Display */}
            {(sublabel || relativeBadge || altCalendarStr) && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#8899BB] mt-0.5 flex-wrap">
                {sublabel && <span>{sublabel}</span>}
                {relativeBadge && (
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                      relativeBadge === 'Today'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-[#00D4AA]'
                        : 'bg-slate-100 dark:bg-[#1E2D40] text-slate-700 dark:text-[#CBD5E1]'
                    }`}
                  >
                    {relativeBadge}
                  </span>
                )}
                {altCalendarStr && (
                  <span className="font-mono text-[9px] opacity-85 truncate">
                    E.C. {altCalendarStr}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Interactive Chevron Trigger */}
          <div className="shrink-0 flex items-center gap-1.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-indigo-500' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-500 dark:text-[#8899BB] px-1">
          {helperText}
        </p>
      )}

      {/* Hidden Native Input for standard accessibility / form data sync */}
      <input
        ref={nativeInputRef}
        id={id}
        type={type}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* MODERN INTERACTIVE CALENDAR DROPDOWN POPOVER */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-[999] top-full left-0 mt-1.5 w-full min-w-[280px] max-w-sm bg-white dark:bg-[#111726] border border-slate-200 dark:border-[#1E2D40] rounded-2xl shadow-2xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Calendar Header: Month/Year navigation & Calendar System Toggle */}
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-[#8899BB] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2D40] transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white text-center">
                {calendarGrid.headerTitle}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-[#8899BB] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2D40] transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Calendar Systems & Actions Bar */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-[#1E2D40]">
            {/* Toggle Calendar Type: Ethiopian vs Gregorian */}
            <div className="flex items-center bg-slate-100 dark:bg-[#1C2333] p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveCalType('ETHIOPIAN');
                }}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeCalType === 'ETHIOPIAN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🇪🇹 E.C.
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveCalType('GREGORIAN');
                }}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeCalType === 'GREGORIAN'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🌐 G.C.
              </button>
            </div>

            {/* Quick Today Jump */}
            <button
              type="button"
              onClick={handleJumpToday}
              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#1C2333] dark:hover:bg-[#1E2D40] text-slate-700 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Today
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2D40] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Weekday Names Row */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarGrid.dayLabels.map((lbl, idx) => (
              <span
                key={idx}
                className="text-[10px] font-bold text-slate-400 dark:text-[#8899BB] py-0.5 uppercase tracking-wider"
              >
                {lbl}
              </span>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.days.map((item) => {
              if (item.isBlank) {
                return <div key={item.key} className="h-7 w-7" />;
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => item.gregDate && handleSelectDate(item.gregDate)}
                  className={`h-7 w-full rounded-lg text-xs font-mono transition-all flex items-center justify-center cursor-pointer ${
                    item.isSelected
                      ? colorMap.selectedDay
                      : item.isToday
                      ? colorMap.todayRing + ' hover:bg-slate-100 dark:hover:bg-[#1E2D40]'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2D40]'
                  }`}
                >
                  {item.dayNumber}
                </button>
              );
            })}
          </div>

          {/* Time Picker Section (if datetime-local) */}
          {type === 'datetime-local' && (
            <div className="pt-2.5 border-t border-slate-100 dark:border-[#1E2D40] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700 dark:text-[#8899BB] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" />
                  Time (HH:mm)
                </span>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>

              {/* Fast Time Presets */}
              <div className="flex items-center gap-1 flex-wrap">
                {['09:00', '12:00', '15:00', '18:00'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTimeChange(t)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                      selectedTime === t
                        ? colorMap.presetActive
                        : 'bg-slate-100 dark:bg-[#1C2333] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    handleTimeChange(curTime);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  Now
                </button>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={`w-full py-1.5 rounded-xl font-bold text-xs ${colorMap.accentBtn} shadow-sm transition-all cursor-pointer`}
                >
                  Confirm Date & Time
                </button>
              </div>
            </div>
          )}

          {/* Quick Presets row inside popup if provided */}
          {presets && presets.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-[#1E2D40] flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Presets:</span>
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onChange(preset.value);
                    setIsOpen(false);
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#1C2333] dark:hover:bg-[#1E2D40] text-slate-700 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
