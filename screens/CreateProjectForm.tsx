import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generateProjectDescription } from '../services/geminiService';
import { createProject } from '../services/dataService';

export const CreateProjectForm = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [status, setStatus] = useState('Planning');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [squareIconFile, setSquareIconFile] = useState<File | null>(null);
    const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGenerateDesc = async () => {
        if(!name) return;
        setIsGenerating(true);
        try {
            const desc = await generateProjectDescription(name, "A software development project");
            setDescription(desc);
        } catch (err) {
            console.error("Failed to generate description:", err);
            alert(err instanceof Error ? err.message : "Could not generate description. Please check your Gemini API key.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCoverFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setIsSubmitting(true);
        try {
            await createProject({
                title: name,
                description,
                startDate,
                dueDate,
                priority,
                status: status as any,
            }, coverFile || undefined, squareIconFile || undefined, screenshotFiles.length ? screenshotFiles : undefined);
            
            navigate('/projects');
        } catch (error) {
            console.error("Error creating project:", error);
            alert("Failed to create project. See console for details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto flex flex-col gap-6 md:gap-8 pb-10 p-4 md:p-8">
            <form onSubmit={handleSubmit}>
                <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
                    <div className="flex flex-col gap-1">
                        <nav className="flex text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">
                            <Link to="/projects" className="hover:text-black transition-colors">Projects</Link>
                            <span className="mx-2">/</span>
                            <Link to="/create" className="hover:text-black transition-colors">Create New</Link>
                        </nav>
                        <h1 className="text-gray-900 dark:text-white text-3xl font-extrabold leading-tight tracking-[-0.033em]">Create New Project</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-base font-medium">Define your project goals, timeline, and team.</p>
                    </div>
                    <div className="flex gap-3">
                        <Link to="/create" className="flex items-center gap-2 h-10 px-6 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-card-dark text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Cancel
                        </Link>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="flex items-center gap-2 h-10 px-6 rounded-lg bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-black/10 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-[20px]">check</span>
                            )}
                            <span>{isSubmitting ? 'Creating...' : 'Create Project'}</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col gap-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-700">
                                <span className="material-symbols-outlined text-black">feed</span>
                                <h3 className="text-gray-900 dark:text-white text-lg font-bold">Project Essentials</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-gray-900 dark:text-gray-200" htmlFor="projectName">Project Name <span className="text-red-500">*</span></label>
                                    <input 
                                        value={name} onChange={e => setName(e.target.value)}
                                        className="form-input w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-black focus:ring-black" id="projectName" placeholder="e.g. Q4 Marketing Campaign" required type="text"
                                    />
                                </div>
                                
                                <div className="flex flex-col gap-1.5 pt-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-gray-900 dark:text-gray-200" htmlFor="description">Description</label>
                                        <button 
                                            type="button" 
                                            onClick={handleGenerateDesc}
                                            disabled={isGenerating || !name}
                                            className="flex items-center gap-1.5 text-xs font-bold text-black hover:text-gray-700 transition-colors bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                                        >
                                            <span className={`material-symbols-outlined text-sm ${isGenerating ? 'animate-spin' : ''}`}>{isGenerating ? 'autorenew' : 'auto_awesome'}</span>
                                            Generate with Gemini
                                        </button>
                                    </div>
                                    <textarea 
                                        value={description} onChange={e => setDescription(e.target.value)}
                                        className="form-textarea w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-black focus:ring-black resize-none" id="description" placeholder="Describe the project goals and scope..." rows={5}
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                         <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col gap-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-700">
                                <span className="material-symbols-outlined text-black">date_range</span>
                                <h3 className="text-gray-900 dark:text-white text-lg font-bold">Timeline & Planning</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-gray-900 dark:text-gray-200" htmlFor="startDate">Start Date</label>
                                    <input 
                                        value={startDate} onChange={e => setStartDate(e.target.value)}
                                        className="form-input w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-black focus:ring-black" id="startDate" type="date"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-gray-900 dark:text-gray-200" htmlFor="dueDate">Due Date</label>
                                    <input 
                                        value={dueDate} onChange={e => setDueDate(e.target.value)}
                                        className="form-input w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-black focus:ring-black" id="dueDate" type="date"
                                    />
                                </div>
                                 <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-gray-900 dark:text-gray-200" htmlFor="priority">Priority</label>
                                    <select 
                                        value={priority} onChange={e => setPriority(e.target.value)}
                                        className="form-select w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-black focus:ring-black" id="priority"
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Urgent</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-gray-900 dark:text-gray-200" htmlFor="status">Initial Status</label>
                                    <select 
                                        value={status} onChange={e => setStatus(e.target.value)}
                                        className="form-select w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-black focus:ring-black" id="status"
                                    >
                                        <option>Planning</option>
                                        <option>Active</option>
                                        <option>On Hold</option>
                                    </select>
                                </div>
                            </div>
                         </div>
                    </div>

                    <div className="flex flex-col gap-6">
                         <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col gap-4">
                            <h3 className="text-gray-900 dark:text-white text-lg font-bold border-b border-gray-100 dark:border-gray-700 pb-4">Assets</h3>
                            <div className="flex flex-col gap-3">
                                 <label className="text-sm font-bold text-gray-900 dark:text-gray-200">Cover Image</label>
                                 <div 
                                    className="w-full h-32 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center cursor-pointer hover:border-black transition-colors group relative overflow-hidden"
                                 >
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                    />
                                    {coverFile ? (
                                        <div className="absolute inset-0 z-0">
                                            <img src={URL.createObjectURL(coverFile)} alt="Preview" className="w-full h-full object-cover opacity-60" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-medium text-sm">Change Image</div>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-gray-400 group-hover:text-black mb-1">cloud_upload</span>
                                            <span className="text-xs font-medium text-gray-400 group-hover:text-black">Click to upload</span>
                                        </>
                                    )}
                                 </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="text-sm font-bold text-gray-900 dark:text-gray-200">Square Icon (for lists & selectors)</label>
                                <div
                                    className="w-28 h-28 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center cursor-pointer hover:border-black transition-colors group relative overflow-hidden"
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setSquareIconFile(e.target.files[0]);
                                            }
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                    />
                                    {squareIconFile ? (
                                        <img src={URL.createObjectURL(squareIconFile)} alt="Icon preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-gray-400 group-hover:text-black mb-1">apps</span>
                                            <span className="text-[11px] font-medium text-gray-400 group-hover:text-black text-center px-2">Upload square icon</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="text-sm font-bold text-gray-900 dark:text-gray-200">Screenshots</label>
                                <div className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-3 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Upload up to 6 screenshots (optional).</p>
                                        <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 cursor-pointer hover:border-black">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={(e) => {
                                                    const files = e.target.files ? Array.from(e.target.files).slice(0, 6) : [];
                                                    setScreenshotFiles(files);
                                                }}
                                                className="hidden"
                                            />
                                            <span className="material-symbols-outlined text-sm">upload</span>
                                            Add
                                        </label>
                                    </div>
                                    {screenshotFiles.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {screenshotFiles.map((file) => (
                                                <div key={file.name} className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setScreenshotFiles((prev) => prev.filter((f) => f.name !== file.name))}
                                                        className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};
