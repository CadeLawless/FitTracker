import { WorkoutSession } from "../types"

export const getSessionStatusBadge = (session: WorkoutSession) => {
switch (session.status) {
    case 'active':
    return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-400/20 text-green-800 dark:text-green-200">
        Active
        </span>
    );
    case 'cancelled':
    return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-400/20 text-red-800 dark:text-red-200">
        Cancelled
        </span>
    );
    case 'completed':
    return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200">
        Completed
        </span>
    );
    default:
    return null;
}
};