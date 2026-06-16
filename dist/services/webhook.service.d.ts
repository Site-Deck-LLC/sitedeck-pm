interface WebhookResult {
    success: boolean;
    message: string;
}
export declare function handleTaskCompleted(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleMaterialReceived(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleLaborHoursLogged(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleEquipmentUsageLogged(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleSafetyIncident(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleFieldIssueLogged(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleScheduleChangeRequested(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleAttendanceUpdated(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function handleEquipmentStatusUpdated(payload: Record<string, unknown>): Promise<WebhookResult>;
export declare function sendActivityReady(projectId: string, activityId: string): Promise<WebhookResult>;
export declare function sendMaterialNeeded(projectId: string, poId: string, materialName: string, quantity: number, neededByDate: Date, activityId?: string): Promise<WebhookResult>;
export declare function sendRfiStatusUpdated(projectId: string, rfiNumber: string, status: string, responseText?: string, holdOnActivityId?: string): Promise<WebhookResult>;
export declare function sendSubmittalStatusUpdated(projectId: string, submittalId: string, approvalStatus: string, holdOnActivityId?: string): Promise<WebhookResult>;
export declare function sendScheduleChangeDecided(projectId: string, requestId: string, decision: string, notes?: string, newDates?: {
    startDate?: Date;
    endDate?: Date;
}): Promise<WebhookResult>;
export {};
//# sourceMappingURL=webhook.service.d.ts.map