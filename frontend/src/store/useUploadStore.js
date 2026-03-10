import { create } from 'zustand'

const useUploadStore = create((set, get) => ({
    files: [],
    simulationRequirement: '',
    isPending: false,

    addFiles: (newFiles) => set((state) => ({ files: [...state.files, ...newFiles] })),
    removeFile: (index) => set((state) => ({ files: state.files.filter((_, i) => i !== index) })),
    setSimulationRequirement: (req) => set({ simulationRequirement: req }),

    setPendingUpload: (files, requirement) => set({
        files,
        simulationRequirement: requirement,
        isPending: true
    }),

    getPendingUpload: () => {
        const state = get()
        return {
            files: state.files,
            simulationRequirement: state.simulationRequirement,
            isPending: state.isPending
        }
    },

    clearPendingUpload: () => set({
        files: [],
        simulationRequirement: '',
        isPending: false
    })
}))

export default useUploadStore
