import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useProcessStore = create(
    persist(
        (set, get) => ({
            // Map of simulationId -> session state
            sessions: {},

            // Actions
            updateSession: (simulationId, data) => set((state) => {
                const currentSession = state.sessions[simulationId] || {};
                return {
                    sessions: {
                        ...state.sessions,
                        [simulationId]: {
                            ...currentSession,
                            ...data,
                            lastUpdated: Date.now()
                        }
                    }
                };
            }),

            getSession: (simulationId) => {
                return get().sessions[simulationId];
            },

            clearSession: (simulationId) => set((state) => {
                const newSessions = { ...state.sessions };
                delete newSessions[simulationId];
                return { sessions: newSessions };
            }),

            // Data cleanup: remove sessions older than 7 days
            cleanupOldSessions: (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => set((state) => {
                const now = Date.now();
                const newSessions = {};
                Object.keys(state.sessions).forEach(key => {
                    const session = state.sessions[key];
                    if (session.lastUpdated && (now - session.lastUpdated < maxAgeMs)) {
                        newSessions[key] = session;
                    }
                });
                return { sessions: newSessions };
            })
        }),
        {
            name: 'mirofish-process-storage', // unique name
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ sessions: state.sessions }), // only persist sessions
        }
    )
);

export default useProcessStore;
