// One line per feature string table. Feature files own their tables (`<Feature>Strings`).
enum FeatureStringTables {
    static func registerAll() {
        L10n.register(de: TodayStrings.de, en: TodayStrings.en)
        L10n.register(de: FocusStrings.de, en: FocusStrings.en)
        L10n.register(de: WorkStrings.de, en: WorkStrings.en)
        L10n.register(de: ProjectsStrings.de, en: ProjectsStrings.en)
        L10n.register(de: TaskDetailStrings.de, en: TaskDetailStrings.en)
        L10n.register(de: InboxStrings.de, en: InboxStrings.en)
        L10n.register(de: SearchStrings.de, en: SearchStrings.en)
        L10n.register(de: CaptureStrings.de, en: CaptureStrings.en)
        L10n.register(de: AccountStrings.de, en: AccountStrings.en)
        L10n.register(de: OnboardingStrings.de, en: OnboardingStrings.en)
        L10n.register(de: FirstRunStrings.de, en: FirstRunStrings.en)
        L10n.register(de: PlatformStrings.de, en: PlatformStrings.en)
        L10n.register(de: BillingStrings.de, en: BillingStrings.en)
        L10n.register(de: AiStrings.de, en: AiStrings.en)
        L10n.register(de: ActivityWebStrings.de, en: ActivityWebStrings.en)
        L10n.register(de: FilesWebStrings.de, en: FilesWebStrings.en)
        L10n.register(de: WikiStrings.de, en: WikiStrings.en)
        L10n.register(de: WorkspaceStrings.de, en: WorkspaceStrings.en)
        L10n.register(de: SystemStrings.de, en: SystemStrings.en)
        L10n.register(de: PlanningStrings.de, en: PlanningStrings.en)
        L10n.register(de: TeamStrings.de, en: TeamStrings.en)
        L10n.register(de: MediaStrings.de, en: MediaStrings.en)
        L10n.register(de: ProjectSettingsStrings.de, en: ProjectSettingsStrings.en)
    }
}
