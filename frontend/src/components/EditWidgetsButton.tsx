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
    : { background: 'rgba(0,0,0,0.05)', color: '#3C3C3C' }

  return (
    <div className="flex justify-center py-0.5">
      <button
        onClick={onToggle}
        className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200 cursor-pointer"
        style={buttonStyle}
      >
        {label}
      </button>
    </div>
  )
}
