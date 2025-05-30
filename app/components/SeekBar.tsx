'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface SeekBarProps {
  currentPosition: number // in milliseconds
  duration: number // in milliseconds
  onSeek: (position: number) => void
  className?: string
}

export function SeekBar({ currentPosition, duration, onSeek, className = '' }: SeekBarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState(0)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getPositionFromEvent = useCallback((event: React.MouseEvent | MouseEvent) => {
    if (!progressBarRef.current) return 0
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    return percentage * duration
  }, [duration])

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true)
    const position = getPositionFromEvent(event)
    setDragPosition(position)
    onSeek(position)
  }

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return
    
    const position = getPositionFromEvent(event)
    setDragPosition(position)
  }, [isDragging, getPositionFromEvent])

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!isDragging) return
    
    const position = getPositionFromEvent(event)
    onSeek(position)
    setIsDragging(false)
  }, [isDragging, getPositionFromEvent, onSeek])

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const displayPosition = isDragging ? dragPosition : currentPosition
  const progressPercentage = duration > 0 ? (displayPosition / duration) * 100 : 0

  return (
    <div className={`${className}`}>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{formatTime(displayPosition)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div 
        ref={progressBarRef}
        className="w-full bg-gray-200 rounded-full h-2 cursor-pointer relative"
        onMouseDown={handleMouseDown}
      >
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-100"
          style={{ width: `${progressPercentage}%` }}
        />
        {/* Draggable thumb */}
        <div 
          className="absolute top-0 w-4 h-2 bg-blue-600 rounded-full transform -translate-x-1/2 cursor-grab active:cursor-grabbing"
          style={{ left: `${progressPercentage}%` }}
        />
      </div>
    </div>
  )
}
