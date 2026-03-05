import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC62tP9qUt9bYyE9PBTUFXGOIHaEU1h8zI",
    authDomain: "clinica-cherniauskas-morikawa.firebaseapp.com",
    projectId: "clinica-cherniauskas-morikawa",
    storageBucket: "clinica-cherniauskas-morikawa.firebasestorage.app",
    messagingSenderId: "36749322098",
    appId: "1:36749322098:web:c7341be3e0e2989df4dfeb",
    measurementId: "G-KSP3F93222"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const boardDocRef = doc(db, 'board', 'main');

let tasks = [];
let kanbanColumns = [];
let isInitialized = false;

// Real-time listener from Firebase
onSnapshot(boardDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        tasks = data.tasks || [];
        kanbanColumns = data.columns || [];

        if (kanbanColumns.length === 3 && kanbanColumns[0].id === 'todo') {
            setupDefaultColumns();
            return;
        }

        if (!isInitialized) {
            isInitialized = true;
            init();
        } else if (!docSnap.metadata.hasPendingWrites) {
            renderColumns();
        }
    } else {
        migrateFromLocalStorage();
    }
});

function migrateFromLocalStorage() {
    let localTasks = JSON.parse(localStorage.getItem('kanban_tasks')) || [
        { id: '1', title: 'Bem-vindo ao Kanban!', desc: 'Crie, arraste e apague tarefas para se organizar.', status: 'dia_1' }
    ];
    let localCols = JSON.parse(localStorage.getItem('kanban_columns'));

    if (!localCols || (localCols.length === 3 && localCols[0].id === 'todo')) {
        setupDefaultColumns();
    } else {
        tasks = localTasks;
        kanbanColumns = localCols;
        saveToFirebase();
    }

    if (!isInitialized) {
        isInitialized = true;
        init();
    }
}

function setupDefaultColumns() {
    kanbanColumns = Array.from({ length: 31 }, (_, i) => ({
        id: `dia_${i + 1}`,
        title: `Dia ${i + 1}`
    }));
    saveToFirebase();
}

function saveToFirebase() {
    setDoc(boardDocRef, { tasks, columns: kanbanColumns });
}

// DOM Elements
const board = document.querySelector('.board');
const addColumnContainer = document.querySelector('.add-column-container');
const addColumnBtn = document.getElementById('add-column-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const addTaskBtn = document.getElementById('add-task-btn');
const closeBtns = document.querySelectorAll('.close-btn, .cancel-btn');
const modalTitle = document.getElementById('modal-title');
const titleInput = document.getElementById('task-title');
const descInput = document.getElementById('task-desc');

// Variables
let draggedTask = null;
let currentEditId = null;

// Initialize App
function init() {
    setupModalListeners();
    renderColumns();
}

function setupModalListeners() {
    addTaskBtn.addEventListener('click', () => openModal());

    closeBtns.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) closeModal();
    });

    taskForm.addEventListener('submit', handleFormSubmit);
}

// Save state
function saveTasks() {
    saveToFirebase();
    updateCounts();
}

function saveColumns() {
    saveToFirebase();
}

// Render Columns dynamically
function renderColumns() {
    // Keep Add Column Button
    const addColStr = addColumnContainer.outerHTML;
    board.innerHTML = '';

    // Default column colors index mapping
    const colColors = ['var(--todo-color)', 'var(--inprogress-color)', 'var(--done-color)', '#ec4899', '#8b5cf6', '#14b8a6'];

    kanbanColumns.forEach((col, index) => {
        const colEl = document.createElement('div');
        colEl.className = 'column';
        colEl.dataset.status = col.id;

        const titleColor = colColors[index % colColors.length];

        colEl.innerHTML = `
            <div class="column-header">
                <h2 class="column-title" style="color: ${titleColor}" contenteditable="true" spellcheck="false" title="Clique para renomear">${escapeHTML(col.title)}</h2>
                <div class="column-header-actions">
                    <span class="task-count">0</span>
                    <button class="icon-btn delete-column-btn" title="Excluir Coluna"><span class="material-icons" style="font-size: 16px;">delete</span></button>
                </div>
            </div>
            <div class="task-list"></div>
        `;

        board.appendChild(colEl);
    });

    // Add the Add Column Button back
    board.insertAdjacentHTML('beforeend', addColStr);

    // Re-select after re-rendering
    attachEventListeners();
    renderTasks();
}

// Render dynamic elements
function renderTasks() {
    // Clear lists
    document.querySelectorAll('.column').forEach(col => {
        col.querySelector('.task-list').innerHTML = '';
    });

    tasks.forEach(task => {
        const taskEl = createTaskElement(task);
        const column = document.querySelector(`.column[data-status="${task.status}"] .task-list`);
        if (column) column.appendChild(taskEl);
    });

    updateCounts();
}

function updateCounts() {
    document.querySelectorAll('.column').forEach(col => {
        const status = col.dataset.status;
        const count = tasks.filter(t => t.status === status).length;
        col.querySelector('.task-count').textContent = count;
    });
}

function createTaskElement(task) {
    const el = document.createElement('div');
    el.classList.add('task-card');
    el.draggable = true;
    el.dataset.id = task.id;

    el.innerHTML = `
        <div class="task-header">
            <h3 class="task-title">${escapeHTML(task.title)}</h3>
            <div class="task-actions">
                <button class="icon-btn edit-btn" title="Editar"><span class="material-icons" style="font-size: 18px;">edit</span></button>
                <button class="icon-btn delete-btn" title="Excluir"><span class="material-icons" style="font-size: 18px;">delete</span></button>
            </div>
        </div>
        ${task.desc ? `<p class="task-desc">${escapeHTML(task.desc)}</p>` : ''}
    `;

    // Drag events
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);

    // Click events for edit/delete
    el.querySelector('.edit-btn').addEventListener('click', () => openModal(task));
    el.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    return el;
}

// Drag & Drop Handlers
function handleDragStart(e) {
    draggedTask = this;
    setTimeout(() => this.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id); // Required for Firefox
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedTask = null;
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
}

// Column Event Listeners setup
function attachEventListeners() {
    // Must re-select elements because we recreate the board in renderColumns()
    const currentColumns = document.querySelectorAll('.column');
    const newAddColBtn = document.getElementById('add-column-btn');

    // Board logic
    currentColumns.forEach(col => {
        const taskList = col.querySelector('.task-list');
        const titleEl = col.querySelector('.column-title');
        const deleteColBtn = col.querySelector('.delete-column-btn');
        const colId = col.dataset.status;

        // Editable Column Title
        titleEl.addEventListener('blur', () => {
            const newTitle = titleEl.textContent.trim();
            if (!newTitle) {
                // Restore old title if empty
                const originalColumn = kanbanColumns.find(c => c.id === colId);
                titleEl.textContent = originalColumn ? originalColumn.title : 'Nova Coluna';
                return;
            }

            // Save new title
            const colIndex = kanbanColumns.findIndex(c => c.id === colId);
            if (colIndex > -1) {
                kanbanColumns[colIndex].title = newTitle;
                saveColumns();
            }
        });

        // Enter key to blur and save
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            }
        });

        // Delete Column
        deleteColBtn.addEventListener('click', () => {
            // Check if column has tasks
            const hasTasks = tasks.some(t => t.status === colId);

            if (hasTasks) {
                alert('Não é possível excluir uma coluna que contenha tarefas. Mova ou exclua as tarefas primeiro.');
                return;
            }

            if (confirm(`Tem certeza que deseja excluir a coluna "${titleEl.textContent}"?`)) {
                kanbanColumns = kanbanColumns.filter(c => c.id !== colId);
                saveColumns();
                renderColumns();
            }
        });

        // Drag Over
        col.addEventListener('dragover', e => {
            e.preventDefault(); // Necessary to allow dropping
            e.dataTransfer.dropEffect = 'move';

            const draggingCard = document.querySelector('.dragging');
            if (!draggingCard) return;

            col.classList.add('drag-over');

            const afterElement = getDragAfterElement(taskList, e.clientY);
            if (afterElement == null) {
                taskList.appendChild(draggingCard);
            } else {
                taskList.insertBefore(draggingCard, afterElement);
            }
        });

        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });

        col.addEventListener('drop', e => {
            e.preventDefault();
            col.classList.remove('drag-over');

            const cardId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;

            // Reorder array logically
            moveTaskOrder(cardId, newStatus, taskList);
        });
    });

    // Add Column Button
    if (newAddColBtn) {
        newAddColBtn.addEventListener('click', () => {
            const newId = 'col_' + Date.now();
            kanbanColumns.push({
                id: newId,
                title: 'Nova Coluna'
            });
            saveColumns();
            renderColumns();

            // Focus on new title immediately after render
            setTimeout(() => {
                const justAdded = document.querySelector(`.column[data-status="${newId}"] .column-title`);
                if (justAdded) {
                    justAdded.focus();
                    document.execCommand('selectAll', false, null); // Highlight text
                }
            }, 50);
        });
    }

    // Modal listeners moved to setupModalListeners()
}

function moveTaskOrder(cardId, newStatus, taskListElement) {
    const taskIndex = tasks.findIndex(t => t.id === cardId);
    if (taskIndex === -1) return;

    // Update status
    tasks[taskIndex].status = newStatus;

    // Logic for perfect reordering based on DOM node position
    // (A simpler version just pushes to end or updates status)

    const taskElements = [...taskListElement.querySelectorAll('.task-card')];
    const newDOMIndex = taskElements.findIndex(el => el.dataset.id === cardId);

    const task = tasks.splice(taskIndex, 1)[0];

    // Calculate new position
    let arrayPos = 0;
    let itemsInStatusBefore = 0;

    for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].status === newStatus) {
            if (itemsInStatusBefore === newDOMIndex) {
                break;
            }
            itemsInStatusBefore++;
        }
        arrayPos++;
    }

    tasks.splice(arrayPos, 0, task);
    saveTasks();
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Modal and CRUD handlers
function openModal(task = null) {
    if (task) {
        currentEditId = task.id;
        modalTitle.textContent = 'Editar Tarefa';
        titleInput.value = task.title;
        descInput.value = task.desc || '';
    } else {
        currentEditId = null;
        modalTitle.textContent = 'Nova Tarefa';
        taskForm.reset();
    }
    taskModal.classList.add('active');
    setTimeout(() => titleInput.focus(), 100);
}

function closeModal() {
    taskModal.classList.remove('active');
    setTimeout(() => {
        taskForm.reset();
        currentEditId = null;
    }, 300);
}

function handleFormSubmit(e) {
    e.preventDefault();
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();

    if (!title) return;

    if (currentEditId) {
        // Edit 
        const task = tasks.find(t => t.id === currentEditId);
        if (task) {
            task.title = title;
            task.desc = desc;
        }
    } else {
        // Add default to first column
        const firstColId = kanbanColumns.length > 0 ? kanbanColumns[0].id : 'todo';
        const newTask = {
            id: Date.now().toString(),
            title,
            desc,
            status: firstColId
        };
        tasks.push(newTask);
    }

    saveTasks();
    renderTasks();
    closeModal();
}

function deleteTask(id) {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();

        // Add exit animation
        const el = document.querySelector(`.task-card[data-id="${id}"]`);
        if (el) {
            el.style.transform = 'scale(0.8)';
            el.style.opacity = '0';
            setTimeout(() => renderTasks(), 200);
        } else {
            renderTasks();
        }
    }
}

// Utility to prevent XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initialization is handled by Firebase onSnapshot
// init();

// Export / Import Logic
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

exportBtn.addEventListener('click', () => {
    const backupData = {
        columns: kanbanColumns,
        tasks: tasks
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);

    // Create a physical file with today's date
    const date = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `kanban_backup_${date}.json`);

    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

importBtn.addEventListener('click', () => {
    importFile.click();
});

importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsedData = JSON.parse(e.target.result);

            // Validate structure
            if (parsedData.columns && Array.isArray(parsedData.columns) &&
                parsedData.tasks && Array.isArray(parsedData.tasks)) {

                kanbanColumns = parsedData.columns;
                tasks = parsedData.tasks;

                saveColumns();
                saveTasks();
                renderColumns(); // Re-render everything

                alert('Backup importado com sucesso!');
            } else {
                alert('O arquivo selecionado não contém um formato de backup válido.');
            }
        } catch (error) {
            alert('Erro ao ler o arquivo. Certifique-se de que é um JSON válido.');
            console.error(error);
        }

        // Reset file input so same file can be imported again
        importFile.value = '';
    };

    reader.readAsText(file);
});
