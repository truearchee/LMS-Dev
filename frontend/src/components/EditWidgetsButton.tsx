interface EditWidgetsButtonProps {
  isEditMode: boolean
  isEmpty: boolean
  onToggle: () => void
}

export function EditWidgetsButton({ isEditMode, isEmpty, onToggle }: EditWidgetsButtonProps) {
  const label = isEmpty && !isEditMode
    ? 'Add Widgets'
    : isEditMode
    ? 'Done'
    : 'Edit Widgets'

  const buttonStyle = isEditMode
    ? { background: '#3C3C3C', color: '#FFFFFF', boxShadow: '0px 2px 8px rgba(0,0,0,0.2)' }
    : { background: 'rgba(0,0,0,0.06)', color: '#3C3C3C' }

  return (
    <button
      onClick={onToggle}
      className="w-full py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer flex-shrink-0"
      style={buttonStyle}
    >
      {label}
    </button>
  )
}
