// Copy for the startup-company step of the project creation sheet (DE/EN). Merged into `ProjectsStrings`.
// Keys that exist on the web keep the web key and wording (`createProjectWizard.startup.*`, `createProjectWizard.toast.*`).
enum StartupSeedingStrings {
    static let de: [String: String] = [
        "projects.new.step.startup": "Startup-Setup",
        "projects.new.startup.jurisdiction": "Gründungsland",
        "projects.new.startup.tracks": "Startup-Workstreams",
        "createProjectWizard.startup.tracks.subtitle": "Wähle, welche editierbaren Meilensteine, Initiativen und Aufgaben ProjectFlow anlegen soll.",
        "createProjectWizard.startup.confirmSensitive.label": "Mir ist bewusst, dass diese Legal-, Finanzierungs-, Finanz- oder Compliance-Aufgaben Planungshilfen sind und mit qualifizierten Beratern geprüft werden müssen.",
        "createProjectWizard.startup.confirmSensitive.error": "Bestätige die sensiblen Startup-Workstreams, bevor du fortfährst.",
        "projects.new.startup.sensitive": "Beratung eingeplant",
        "projects.new.startup.summary": "{tracks} Workstreams · {tasks} Aufgaben, {initiatives} Initiativen, {milestones} Meilensteine",
        "createProjectWizard.toast.createdWithSetupWarning": "Projekt \"{name}\" erstellt, aber einige Setup-Elemente konnten nicht hinzugefügt werden.",
    ]
    static let en: [String: String] = [
        "projects.new.step.startup": "Startup setup",
        "projects.new.startup.jurisdiction": "Jurisdiction",
        "projects.new.startup.tracks": "Startup workstreams",
        "createProjectWizard.startup.tracks.subtitle": "Choose the editable milestones, initiatives, and tasks ProjectFlow should create.",
        "createProjectWizard.startup.confirmSensitive.label": "I understand these legal, finance, funding, or compliance tasks are planning aids and must be reviewed with qualified advisors.",
        "createProjectWizard.startup.confirmSensitive.error": "Confirm the sensitive startup tracks before continuing.",
        "projects.new.startup.sensitive": "Advisor review planned",
        "projects.new.startup.summary": "{tracks} workstreams · {tasks} tasks, {initiatives} initiatives, {milestones} milestones",
        "createProjectWizard.toast.createdWithSetupWarning": "Project \"{name}\" created, but some generated setup items could not be added.",
    ]
}
