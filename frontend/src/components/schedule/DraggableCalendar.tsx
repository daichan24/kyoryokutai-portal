import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card } from '@/components/ui/card';
import { Schedule } from '@/types';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Clock, MapPin } from 'lucide-react';

interface DraggableCalendarProps {
  schedules: Schedule[];
  onScheduleMove: (scheduleId: string, newDate: Date, newStartTime: string) => void;
}

export function DraggableCalendar({ schedules, onScheduleMove }: DraggableCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const getSchedulesForDay = (date: Date) => {
    return schedules
      .filter((s) => isSameDay(new Date(s.date), date))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceDay = parseInt(result.source.droppableId.split('-')[1]);
    const destDay = parseInt(result.destination.droppableId.split('-')[1]);

    if (sourceDay === destDay) return;

    const schedule = schedules.find((s) => s.id === result.draggableId);
    if (!schedule) return;

    const newDate = weekDays[destDay];
    onScheduleMove(schedule.id, newDate, schedule.startTime);
  };

  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          {format(currentWeek, 'yyyy年M月', { locale: ja })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
            className="px-3 py-1 border rounded hover:bg-gray-100"
          >
            前の週
          </button>
          <button
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1 border rounded hover:bg-gray-100"
          >
            今週
          </button>
          <button
            onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
            className="px-3 py-1 border rounded hover:bg-gray-100"
          >
            次の週
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, dayIndex) => (
            <div key={dayIndex} className="min-h-[200px]">
              <div className="text-center mb-2">
                <div className="text-sm text-gray-600">
                  {format(day, 'E', { locale: ja })}
                </div>
                <div
                  className={`text-lg font-semibold ${
                    isSameDay(day, new Date()) ? 'text-blue-600' : ''
                  }`}
                >
                  {format(day, 'd')}
                </div>
              </div>

              <Droppable droppableId={`day-${dayIndex}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[150px] p-2 border-2 rounded-lg ${
                      snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="space-y-2">
                      {getSchedulesForDay(day).map((schedule, index) => (
                        <Draggable
                          key={schedule.id}
                          draggableId={schedule.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-2 cursor-move ${
                                snapshot.isDragging ? 'shadow-lg opacity-80' : ''
                              } ${schedule.isPending ? 'border-l-4 border-l-yellow-500' : ''}`}
                            >
                              <div className="text-xs space-y-1">
                                <div className="flex items-center gap-1 text-gray-600">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {schedule.startTime.slice(0, 5)} - {schedule.endTime.slice(0, 5)}
                                  </span>
                                </div>

                                {schedule.locationText && (
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{schedule.locationText}</span>
                                  </div>
                                )}

                                <div className="font-medium text-gray-900 line-clamp-2">
                                  {schedule.activityDescription}
                                </div>

                                {schedule.user && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <div
                                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                                      style={{ backgroundColor: schedule.user.avatarColor }}
                                    >
                                      {schedule.user.name.charAt(0)}
                                    </div>
                                    <span className="text-xs text-gray-600">
                                      {schedule.user.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <div className="mt-4 text-sm text-gray-500">
        ドラッグ&ドロップでスケジュールを移動できます
      </div>
    </div>
  );
}
