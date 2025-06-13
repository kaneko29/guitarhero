'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface SeekBarProps {
  value: number // in milliseconds
  max: number // in milliseconds
  onChange: (position: number) => void
  className?: string
}

export function SeekBar({ value, max, onChange, className = '' }: SeekBarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState(0)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const getPositionFromEvent = useCallback((event: React.MouseEvent | MouseEvent) => {
    if (!progressBarRef.current) return 0

    const rect = progressBarRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    return percentage * max
  }, [max])

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    setIsDragging(true)
    const position = getPositionFromEvent(event)
    setDragPosition(position)
    onChange(position)
  }

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return

    const position = getPositionFromEvent(event)
    setDragPosition(position)
    onChange(position)
  }, [isDragging, getPositionFromEvent, onChange])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
  }, [isDragging])

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

  const displayPosition = isDragging ? dragPosition : value
  const progressPercentage = max > 0 ? (displayPosition / max) * 100 : 0

  return (
    <div className={`relative ${className}`}>
      <div
        ref={progressBarRef}
        className="w-full h-2 bg-secondary rounded-full cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        <div
          className={`absolute top-0 left-0 h-full bg-primary rounded-full ${isDragging ? '' : 'transition-all duration-75'}`}
          style={{ width: `${progressPercentage}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full transform -translate-x-1/2 cursor-grab active:cursor-grabbing hover:scale-110 ${isDragging ? '' : 'transition-transform'}`}
          style={{ left: `${progressPercentage}%` }}
        />
      </div>
    </div>
  )
}
