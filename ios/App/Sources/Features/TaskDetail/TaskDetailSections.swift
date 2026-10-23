import SwiftUI
import PFData
import PFDesign
import PFModel

// MARK: - Header (eyebrow, title, pills)

extension TaskDetailScreen {
    func header(_ task: WorkTask) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            eyebrow
            PFEditableText(L10n.t("taskDetail.title.placeholder"), text: $titleDraft, style: .title, isEditable: canEdit, lineLimit: 1...6) { value in
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { titleDraft = task.title; return }
                guard trimmed != task.title else { return }
                run { try await $0.setTitle(ref, trimmed) }
            }
            .accessibilityAddTraits(.isHeader)
            pills(task)
        }
    }

    @ViewBuilder private var eyebrow: some View {
        HStack(spacing: 6) {
            if let projectModel {
                Button {
                    model.router.push(.project(tenantId: ref.tenantId, projectId: ref.projectId))
                } label: {
                    PFEyebrow(projectModel.title)
                }
                .buttonStyle(.plain)
            }
            if let initiative {
                Text("·").pfText(.eyebrow).foregroundStyle(PFColor.textSubtle)
                Button {
                    model.router.push(.initiative(tenantId: ref.tenantId, projectId: ref.projectId, initiativeId: initiative.id))
                } label: {
                    PFEyebrow(initiative.title)
                }
                .buttonStyle(.plain)
            }
        }
        .lineLimit(1)
    }

    private func pills(_ task: WorkTask) -> some View {
        FlowLayout(spacing: 8) {
            PFPillButton(task.status.label, tone: .status(task.status.tone), isEnabled: canEdit) { presentStatusSheet(task) }
            PFPillButton(task.priority?.label ?? L10n.t("priority.none"), tone: .neutral, isEnabled: canEdit, action: { presentPrioritySheet(task) }) {
                PFPrioritySignal(task.priority)
            }
            if let due = task.dueDate {
                PFPillButton(Formatting.dueText(due) ?? Formatting.shortDate(due),
                             tone: .severity(Formatting.severity(due: due, isDone: task.isCompleted) == .done ? .neutral : Formatting.severity(due: due)),
                             isEnabled: canEdit) { presentDateSheet(.due, task) }
            } else if canEdit {
                PFPillButton(L10n.t("taskDetail.timeline.noDueDate"), tone: .neutral, isEnabled: true, action: { presentDateSheet(.due, task) }) {
                    Image(systemName: "calendar").font(.system(size: 10, weight: .bold))
                }
            }
        }
    }

    func presentStatusSheet(_ task: WorkTask) {
        presenter.present(detents: [.fit]) {
            OptionSheet(title: L10n.t("common.status"), options: TaskStatus.workflow.map { status in
                OptionSheet.Option(id: status.rawValue, label: status.label, isSelected: status == task.status) {
                    PFDot(PFColor.statusBase(status.tone), size: 12)
                }
            }) { id in
                guard let status = TaskStatus(rawValue: id), status != task.status else { return }
                changeStatus(status, from: task)
            }
        }
    }

    private func changeStatus(_ status: TaskStatus, from task: WorkTask) {
        switch status {
        case .blocked:
            PFHaptics.warning()
            focusBlockerField = true
            run { try await $0.setBlocked(ref, note: task.blockerNote) }
        case .inProgress where task.status == .blocked:
            PFHaptics.selection()
            run { try await $0.clearBlocker(ref) }
        case .done:
            Task { await WorkItemActions(model: model).toggleComplete(.task(task)) }
        default:
            Task { await WorkItemActions(model: model).setStatus(.task(task), status) }
        }
    }

    func presentPrioritySheet(_ task: WorkTask) {
        WorkItemActions(model: model).presentPriority(.task(task))
    }

    enum DateField { case due, start, scheduled }

    func presentDateSheet(_ field: DateField, _ task: WorkTask) {
        let (eyebrow, current): (String, FlexDate?) = switch field {
        case .due: (L10n.t("taskDetail.timeline.dueDate"), task.dueDate)
        case .start: (L10n.t("taskDetail.timeline.startDate"), task.startDate)
        case .scheduled: (L10n.t("taskDetail.timeline.scheduled"), task.scheduledDate)
        }
        presenter.present(detents: [.fit]) {
            DateSheet(eyebrow: eyebrow, title: task.title, initial: current) { date in
                run { actions in
                    switch field {
                    case .due: try await actions.setDueDate(ref, date)
                    case .start: try await actions.setStartDate(ref, date)
                    case .scheduled: try await actions.setScheduledDate(ref, date)
                    }
                }
            }
        }
    }
}

// MARK: - Workbench

extension TaskDetailScreen {
    func workbench(_ task: WorkTask) -> some View {
        let blocked = task.status == .blocked && !task.isCompleted
        return VStack(alignment: .leading, spacing: 10) {
            if task.isCompleted {
                PFEyebrow(L10n.t("taskDetail.workbench.executionDone"), color: PFColor.successText)
                if let completed = task.completedAt?.instant {
                    Text(L10n.t("taskDetail.workbench.doneAt", ["date": completed.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(L10n.locale))]))
                        .pfText(.body).foregroundStyle(PFColor.textMuted)
                }
            } else if blocked {
                PFEyebrow(L10n.t("taskDetail.workbench.blocker"), color: PFColor.dangerText)
                PFEditableText(L10n.t("taskDetail.workbench.blockerPlaceholder"), text: $blockerDraft, style: .body, isEditable: canEdit, autofocus: focusBlockerField) { value in
                    focusBlockerField = false
                    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard trimmed != (task.blockerNote ?? "") else { return }
                    run { try await $0.setBlocked(ref, note: trimmed) }
                }
                .id("blocker")
                if task.blockerNote == nil, let first = dependencies(of: task).first {
                    Label(L10n.t("taskDetail.workbench.waitingFor", ["title": first.title]), systemImage: "hourglass")
                        .pfText(.meta)
                        .foregroundStyle(PFColor.textMuted)
                }
            } else {
                PFEyebrow(L10n.t("taskDetail.workbench.nextStep"))
                PFEditableText(L10n.t("taskDetail.workbench.nextStepPlaceholder"), text: $nextStepDraft, style: .body, isEditable: canEdit) { value in
                    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard trimmed != (task.nextStep ?? "") else { return }
                    run { try await $0.setNextStep(ref, trimmed) }
                }
                .id("next")
            }
            if !task.isCompleted {
                HStack(spacing: PFSpace.xs) {
                    if blocked {
                        if canEdit {
                            PFButton(L10n.t("taskDetail.workbench.clearBlocker"), systemImage: "lock.open", size: .small) {
                                PFHaptics.success()
                                run { try await $0.clearBlocker(ref) }
                            }
                        }
                        focusButton(kind: .ghost)
                    } else {
                        focusButton(kind: .primary)
                        if canEdit {
                            PFButton(L10n.t("taskDetail.workbench.markBlocked"), systemImage: "exclamationmark.octagon", kind: .ghost, size: .small) {
                                PFHaptics.warning()
                                focusBlockerField = true
                                run { try await $0.setBlocked(ref, note: nil) }
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.top, 2)
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfEdgeCard(blocked ? PFColor.danger : nil)
    }

    private func focusButton(kind: PFButtonKind) -> some View {
        PFButton(isFocused ? L10n.t("taskDetail.focus.open") : L10n.t("common.startFocus"), systemImage: "scope", kind: kind, size: .small) { startFocus() }
    }
}

// MARK: - Subtasks

extension TaskDetailScreen {
    func subtasksCard(_ task: WorkTask) -> some View {
        let subtasks = store.subtasks
        let done = subtasks.filter(\.isCompleted).count
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(L10n.t("taskDetail.subtasks.label")).pfText(.section).foregroundStyle(PFColor.textMain)
                Spacer()
                if !subtasks.isEmpty { Text("\(done) / \(subtasks.count)").pfText(.number).foregroundStyle(PFColor.textMuted) }
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.top, PFSpace.m)
            .padding(.bottom, subtasks.isEmpty ? 4 : 10)
            if !subtasks.isEmpty {
                PFProgressBar(value: Double(done) / Double(subtasks.count), height: 4)
                    .padding(.horizontal, PFSpace.m)
                    .padding(.bottom, 4)
            }
            ForEach(subtasks) { subtask in
                PFRowDivider()
                subtaskRow(subtask)
            }
            if canEdit {
                PFRowDivider()
                HStack(spacing: PFSpace.s) {
                    Image(systemName: "plus").font(.system(size: 14, weight: .semibold)).foregroundStyle(PFColor.textSubtle).frame(width: 20)
                    TextField("", text: $newSubtask, prompt: Text(L10n.t("taskDetail.subtasks.addPlaceholder")).foregroundStyle(PFColor.textSubtle))
                        .textFieldStyle(.plain)
                        .pfText(.body)
                        .foregroundStyle(PFColor.textMain)
                        .focused($subtaskFocused)
                        .submitLabel(.next)
                        .onSubmit(addSubtask)
                }
                .padding(.horizontal, PFSpace.m + 2)
                .frame(minHeight: 52)
                .contentShape(.rect)
                .onTapGesture { subtaskFocused = true }
            }
        }
        .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
        .pfCard()
    }

    private func subtaskRow(_ subtask: SubTask) -> some View {
        let toggle = PFSwipeAction(subtask.isCompleted ? L10n.t("common.reopen") : L10n.t("common.complete"),
                                   systemImage: subtask.isCompleted ? "arrow.uturn.backward" : "checkmark", tint: PFColor.success) {
            run { try await $0.setSubtask(ref, subtaskId: subtask.id, completed: !subtask.isCompleted) }
        }
        let remove = PFSwipeAction(L10n.t("common.delete"), systemImage: "trash", tint: PFColor.danger) { confirmDeleteSubtask(subtask) }
        return PFSwipeRow(leading: canEdit ? toggle : nil, trailing: canEdit ? [remove] : []) {
            HStack(spacing: 0) {
                PFCheckCircle(isOn: subtask.isCompleted, label: subtask.isCompleted ? L10n.t("common.reopen") : L10n.t("common.complete")) {
                    guard canEdit else { return }
                    run { try await $0.setSubtask(ref, subtaskId: subtask.id, completed: !subtask.isCompleted) }
                }
                .padding(.leading, 2)
                Text(subtask.title)
                    .pfText(.body)
                    .foregroundStyle(subtask.isCompleted ? PFColor.textMuted : PFColor.textMain)
                    .strikethrough(subtask.isCompleted, color: PFColor.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 10)
                    .padding(.trailing, PFSpace.m)
            }
            .frame(minHeight: 48)
        }
    }

    private func addSubtask() {
        let title = newSubtask.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        newSubtask = ""
        PFHaptics.selection()
        run { try await $0.addSubtask(ref, title: title) }
        subtaskFocused = true
    }

    private func confirmDeleteSubtask(_ subtask: SubTask) {
        presenter.present(detents: [.fit]) {
            ConfirmSheet(title: L10n.t("taskDetail.confirm.deleteSubtask.title"), message: L10n.t("taskDetail.confirm.deleteSubtask.message"),
                         confirmTitle: L10n.t("taskDetail.confirm.deleteSubtask.confirm")) {
                run { try await $0.deleteSubtask(ref, subtaskId: subtask.id) }
            }
        }
    }
}

// MARK: - Description

extension TaskDetailScreen {
    func descriptionCard(_ task: WorkTask) -> some View {
        let document = RichHTML.parse(task.summary)
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack {
                Text(L10n.t("taskDetail.description.label")).pfText(.section).foregroundStyle(PFColor.textMain)
                Spacer()
                if canEdit, !isEditingDescription, !document.isEmpty, document.isEditable {
                    Button {
                        startEditingDescription(task, document)
                    } label: {
                        Image(systemName: "pencil").font(.system(size: 14, weight: .semibold)).foregroundStyle(PFColor.textMuted)
                            .frame(width: 34, height: 34).background(PFColor.raised, in: .circle)
                    }
                    .buttonStyle(.pfPressable)
                    .accessibilityLabel(L10n.t("common.edit"))
                }
            }
            if isEditingDescription {
                RichTextEditorView(controller: editor)
                    .task {
                        editor.load(document)
                        editor.focus()
                    }
            } else if document.isEmpty {
                if canEdit {
                    Button { startEditingDescription(task, document) } label: {
                        Label(L10n.t("taskDetail.description.add"), systemImage: "text.alignleft")
                            .pfText(.metaStrong)
                            .foregroundStyle(PFColor.textMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(minHeight: 40)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                } else {
                    Text(L10n.t("taskDetail.description.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
            } else {
                RichTextView(html: task.summary)
                if canEdit, !document.isEditable {
                    PFButton(L10n.t("taskDetail.description.editWeb"), systemImage: "safari", kind: .ghost, size: .small) {
                        ProjectsClipboard.open(ProjectLinks.task(ref))
                    }
                    .padding(.top, 4)
                }
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
    }

    private func startEditingDescription(_ task: WorkTask, _ document: RichDocument) {
        descriptionBase = task.summary ?? ""
        withAnimation(PFMotion.respecting(PFMotion.fast)) { isEditingDescription = true }
    }

    func cancelDescription() {
        editor.resign()
        withAnimation(PFMotion.respecting(PFMotion.fast)) { isEditingDescription = false }
    }

    func saveDescription() {
        guard let task else { return }
        let html = editor.html()
        editor.resign()
        // The description is one field: ask before overwriting a change made elsewhere meanwhile.
        if (task.summary ?? "") != (descriptionBase ?? "") {
            presenter.present(detents: [.fit]) {
                ConfirmSheet(title: L10n.t("taskDetail.description.conflict.title"), message: L10n.t("taskDetail.description.conflict.message"),
                             confirmTitle: L10n.t("taskDetail.description.conflict.confirm")) { commitDescription(html) }
            }
            return
        }
        commitDescription(html)
    }

    private func commitDescription(_ html: String) {
        withAnimation(PFMotion.respecting(PFMotion.fast)) { isEditingDescription = false }
        run { try await $0.setDescription(ref, html: html) }
    }

    func presentLinkSheet() {
        let current = editor.currentLink
        presenter.present(detents: [.fit]) {
            LinkSheet(initial: current) { url in editor.applyLink(url) }
        }
    }
}

/// Formatting bar shown above the keyboard while the description is edited.
struct DescriptionToolbar: View {
    let controller: RichEditorController
    let onLink: () -> Void
    let onCancel: () -> Void
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: PFSpace.xs) {
            HStack(spacing: 6) {
                formatButton("bold", label: L10n.t("taskDetail.format.bold"), active: controller.isBold) { controller.toggleBold() }
                formatButton("italic", label: L10n.t("taskDetail.format.italic"), active: controller.isItalic) { controller.toggleItalic() }
                formatButton("textformat.size", label: L10n.t("taskDetail.format.heading"), active: controller.block.isHeading) { controller.setBlock(.h2) }
                formatButton("list.bullet", label: L10n.t("taskDetail.format.bullets"), active: controller.block == .ul) { controller.toggleList(ordered: false) }
                formatButton("list.number", label: L10n.t("taskDetail.format.numbers"), active: controller.block == .ol) { controller.toggleList(ordered: true) }
                formatButton("link", label: L10n.t("taskDetail.format.link"), active: controller.currentLink != nil) { onLink() }
                Spacer(minLength: 0)
            }
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("common.cancel"), kind: .ghost, fullWidth: true, action: onCancel)
                PFButton(L10n.t("common.save"), fullWidth: true, action: onDone)
            }
        }
        .padding(PFSpace.xs)
        .background(PFColor.card, in: .rect(cornerRadius: 26, style: .continuous))
        .pfElevation(.lifted, radius: 26)
    }

    private func formatButton(_ symbol: String, label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button {
            PFHaptics.selection()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(active ? PFColor.onPrimary : PFColor.textMain)
                .frame(width: 42, height: 38)
                .background(active ? PFColor.primary : PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        }
        .buttonStyle(.pfPressable)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Details

extension TaskDetailScreen {
    func detailsCard(_ task: WorkTask) -> some View {
        let people = task.effectiveAssignees.compactMap { model.workspace?.person($0) }
        let milestone = project.milestones.first { $0.linkedTaskIds.contains(task.id) }
        let sprint = task.sprintId.flatMap { id in project.sprints.first { $0.id == id } }
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(L10n.t("taskDetail.details.title")).pfText(.section).foregroundStyle(PFColor.textMain).padding(.horizontal, PFSpace.xxs)
            PFCardList {
                PFDetailRow(L10n.t("taskDetail.assignees.label"), showsChevron: canEdit, action: canEdit ? { presentPeopleSheet(task) } : nil) {
                    if people.isEmpty {
                        Text("—").foregroundStyle(PFColor.textSubtle)
                    } else {
                        HStack(spacing: 8) {
                            PFAvatarStack(people: people.map { ($0.id, $0.displayName, $0.photoURL) }, size: 24, limit: 3)
                            if people.count == 1 { Text(people[0].displayName).lineLimit(1) }
                        }
                    }
                }
                dateRow(L10n.t("taskDetail.timeline.startDate"), task.startDate, .start, task)
                dateRow(L10n.t("taskDetail.timeline.dueDate"), task.dueDate, .due, task)
                dateRow(L10n.t("taskDetail.timeline.scheduled"), task.scheduledDate, .scheduled, task)
                if !task.categories.isEmpty {
                    PFDetailRow(L10n.t("taskDetail.labels.title")) {
                        FlowLayout(spacing: 6) {
                            ForEach(task.categories, id: \.self) { PFPill($0, tone: .neutral, compact: true) }
                        }
                    }
                }
                if let milestone {
                    PFDetailRow(L10n.t("taskDetail.details.milestone")) {
                        Text(milestone.title).lineLimit(1)
                    }
                }
                if let sprint {
                    PFDetailRow(L10n.t("taskDetail.details.sprint")) { Text(sprint.name).lineLimit(1) }
                }
                if let initiative {
                    PFDetailRow(L10n.t("taskDetail.details.initiative"), showsChevron: true, action: {
                        model.router.push(.initiative(tenantId: ref.tenantId, projectId: ref.projectId, initiativeId: initiative.id))
                    }) { Text(initiative.title).lineLimit(1) }
                }
                if let created = task.createdAt?.instant {
                    PFDetailRow(L10n.t("taskDetail.details.created")) {
                        let by = model.workspace?.person(task.createdBy ?? task.ownerId)?.displayName
                        Text([created.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale)), by].compactMap { $0 }.joined(separator: " · "))
                            .foregroundStyle(PFColor.textMuted)
                            .lineLimit(1)
                    }
                }
            }
        }
    }

    private func dateRow(_ label: String, _ value: FlexDate?, _ field: DateField, _ task: WorkTask) -> some View {
        PFDetailRow(label, showsChevron: canEdit, action: canEdit ? { presentDateSheet(field, task) } : nil) {
            if let value {
                Text(Formatting.shortDate(value))
                    .foregroundStyle(field == .due ? PFColor.severityText(Formatting.severity(due: value, isDone: task.isCompleted)) : PFColor.textMain)
            } else {
                Text("—").foregroundStyle(PFColor.textSubtle)
            }
        }
    }

    private func presentPeopleSheet(_ task: WorkTask) {
        var candidates = members
        for id in task.effectiveAssignees where !candidates.contains(where: { $0.id == id }) {
            if let person = model.workspace?.person(id) { candidates.append(person) }
        }
        presenter.present(detents: [.fit]) {
            PeopleSheet(title: task.title, people: candidates, initial: task.effectiveAssignees) { ids in
                run { try await $0.setAssignees(ref, ids) }
            }
        }
    }
}

// MARK: - Reminders (contract C2)

extension TaskDetailScreen {
    func remindersCard(_ task: WorkTask) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(L10n.t("taskDetail.reminders.title")).pfText(.section).foregroundStyle(PFColor.textMain).padding(.horizontal, PFSpace.xxs)
            VStack(spacing: 0) {
                ForEach(Array(task.reminders.enumerated()), id: \.element.id) { index, reminder in
                    if index > 0 { PFRowDivider() }
                    reminderRow(reminder, in: task)
                }
                if canEdit {
                    if !task.reminders.isEmpty { PFRowDivider() }
                    Button {
                        guard let uid = model.uid else { return }
                        presenter.present(detents: [.fit]) {
                            ReminderSheet(uid: uid) { reminder in
                                run { try await $0.setReminders(ref, task.reminders + [reminder]) }
                            }
                        }
                    } label: {
                        HStack(spacing: PFSpace.s) {
                            Image(systemName: "plus").font(.system(size: 14, weight: .semibold)).frame(width: 20)
                            Text(L10n.t("taskDetail.reminders.add")).pfText(.body)
                            Spacer()
                        }
                        .foregroundStyle(PFColor.textMuted)
                        .padding(.horizontal, PFSpace.m + 2)
                        .frame(minHeight: 52)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                } else if task.reminders.isEmpty {
                    Text(L10n.t("taskDetail.reminders.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(PFSpace.m)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfCard()
        }
    }

    private func reminderRow(_ reminder: ProjectReminder, in task: WorkTask) -> some View {
        let complete = PFSwipeAction(reminder.isCompleted ? L10n.t("taskDetail.reminders.reopen") : L10n.t("taskDetail.reminders.complete"),
                                     systemImage: reminder.isCompleted ? "arrow.uturn.backward" : "checkmark", tint: PFColor.success) {
            var updated = task.reminders
            if let index = updated.firstIndex(where: { $0.id == reminder.id }) { updated[index].isCompleted.toggle() }
            run { try await $0.setReminders(ref, updated) }
        }
        let remove = PFSwipeAction(L10n.t("common.delete"), systemImage: "trash", tint: PFColor.danger) {
            run { try await $0.setReminders(ref, task.reminders.filter { $0.id != reminder.id }) }
        }
        return PFSwipeRow(leading: canEdit ? complete : nil, trailing: canEdit ? [remove] : []) {
            HStack(spacing: PFSpace.s) {
                Image(systemName: reminder.sentAt != nil ? "bell.badge" : "bell")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(PFColor.textMuted)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(reminder.title).pfText(.body)
                        .foregroundStyle(reminder.isCompleted ? PFColor.textMuted : PFColor.textMain)
                        .strikethrough(reminder.isCompleted, color: PFColor.textMuted)
                    HStack(spacing: 6) {
                        if let at = reminder.remindAt {
                            Text(at.instant.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).hour().minute().locale(L10n.locale)))
                                .pfText(.meta).foregroundStyle(PFColor.textMuted)
                        }
                        if reminder.notifyAssignees {
                            Text("· " + L10n.t("taskDetail.reminders.withAssignees")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                        }
                    }
                }
                Spacer(minLength: 0)
                if reminder.sentAt != nil { PFPill(L10n.t("taskDetail.reminders.sent"), tone: .status(.done), compact: true) }
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 56)
        }
    }
}

// MARK: - Relationships

extension TaskDetailScreen {
    func lookup(_ id: String) -> WorkTask? { project.tasks.first { $0.id == id } ?? store.related[id] }

    func dependencies(of task: WorkTask) -> [WorkTask] { task.dependencies.compactMap(lookup) }

    func relationshipsCard(_ task: WorkTask) -> some View {
        let blockedBy = dependencies(of: task)
        let blocking = project.tasks.filter { $0.dependencies.contains(ref.taskId) }
        let parent = task.parentTaskId.flatMap(lookup)
        let children = project.tasks.filter { $0.parentTaskId == ref.taskId }
        let isEmpty = blockedBy.isEmpty && blocking.isEmpty && parent == nil && children.isEmpty && !canEdit
        return Group {
            if !isEmpty {
                VStack(alignment: .leading, spacing: PFSpace.s) {
                    Text(L10n.t("taskDetail.relationships.title")).pfText(.section).foregroundStyle(PFColor.textMain).padding(.horizontal, PFSpace.xxs)
                    VStack(spacing: 0) {
                        relationSection(L10n.t("taskDetail.relationships.blockedBy"), tasks: blockedBy, removable: true)
                        if canEdit {
                            if !blockedBy.isEmpty { PFRowDivider() }
                            Button { presentBlockerPicker(task) } label: {
                                HStack(spacing: PFSpace.s) {
                                    Image(systemName: "plus").font(.system(size: 14, weight: .semibold)).frame(width: 20)
                                    Text(L10n.t("taskDetail.relationships.addBlocker")).pfText(.body)
                                    Spacer()
                                }
                                .foregroundStyle(PFColor.textMuted)
                                .padding(.horizontal, PFSpace.m + 2)
                                .frame(minHeight: 52)
                                .contentShape(.rect)
                            }
                            .buttonStyle(.pfPressable)
                        }
                        if !blocking.isEmpty { PFRowDivider(); relationSection(L10n.t("taskDetail.relationships.blocking"), tasks: blocking, removable: false) }
                        if let parent { PFRowDivider(); relationSection(L10n.t("taskDetail.relationships.parent"), tasks: [parent], removable: false) }
                        if !children.isEmpty { PFRowDivider(); relationSection(L10n.t("taskDetail.relationships.children"), tasks: children, removable: false) }
                    }
                    .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
                    .pfCard()
                }
            }
        }
    }

    private func relationSection(_ title: String, tasks: [WorkTask], removable: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if !tasks.isEmpty {
                PFEyebrow(title)
                    .padding(.horizontal, PFSpace.m)
                    .padding(.top, PFSpace.s)
                    .padding(.bottom, 2)
                ForEach(tasks) { related in
                    HStack(spacing: PFSpace.xs) {
                        Button {
                            model.router.push(.task(related.ref))
                        } label: {
                            HStack(spacing: PFSpace.s) {
                                Text(related.title)
                                    .pfText(.body)
                                    .foregroundStyle(related.isCompleted ? PFColor.textMuted : PFColor.textMain)
                                    .strikethrough(related.isCompleted, color: PFColor.textMuted)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                                PFPill(related.status.label, tone: .status(related.status.tone), compact: true)
                            }
                            .frame(minHeight: 48)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.pfPressable)
                        if removable, canEdit {
                            Button {
                                PFHaptics.selection()
                                run { try await $0.removeDependency(ref, related.id) }
                            } label: {
                                Image(systemName: "minus.circle.fill").font(.system(size: 18)).foregroundStyle(PFColor.textSubtle).frame(width: 32, height: 40)
                            }
                            .buttonStyle(.pfPressable)
                            .accessibilityLabel(L10n.t("taskDetail.relationships.unlink"))
                        }
                    }
                    .padding(.horizontal, PFSpace.m)
                }
            }
        }
    }

    private func presentBlockerPicker(_ task: WorkTask) {
        let candidates = project.tasks.filter { $0.id != ref.taskId && !task.dependencies.contains($0.id) }
        presenter.present(detents: [.fit]) {
            TaskPickerSheet(title: task.title, tasks: candidates) { other in
                PFHaptics.warning()
                run { try await $0.addDependency(ref, blockedBy: other.id) }
            }
        }
    }
}

// MARK: - Activity

extension TaskDetailScreen {
    @ViewBuilder var activityCard: some View {
        let entries = Array(store.activity.prefix(5))
        if !entries.isEmpty {
            VStack(alignment: .leading, spacing: PFSpace.s) {
                Text(L10n.t("taskDetail.activity.title")).pfText(.section).foregroundStyle(PFColor.textMain).padding(.horizontal, PFSpace.xxs)
                VStack(spacing: 0) {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                        if index > 0 { PFRowDivider(leadingInset: 56) }
                        ActivityRow(entry: entry)
                    }
                }
                .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
                .pfCard()
            }
        }
    }
}
