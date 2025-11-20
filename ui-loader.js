// UX индикаторы загрузки
class UILoader {
    static showSkeleton(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="skeleton-loader">
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-line"></div>
            </div>
        `;
    }

    static showSpinner(text = 'Загрузка...') {
        const spinner = document.createElement('div');
        spinner.id = 'spinner';
        spinner.innerHTML = `
            <div class="spinner-overlay">
                <div class="spinner"></div>
                <div class="spinner-text">${text}</div>
            </div>
        `;
        document.body.appendChild(spinner);
    }

    static hideSpinner() {
        const spinner = document.getElementById('spinner');
        if (spinner) spinner.remove();
    }

    static showProgress(percent) {
        let progress = document.getElementById('progress-bar');
        if (!progress) {
            progress = document.createElement('div');
            progress.id = 'progress-bar';
            progress.innerHTML = '<div class="progress-fill"></div>';
            document.body.appendChild(progress);
        }
        progress.querySelector('.progress-fill').style.width = `${percent}%`;
    }

    static hideProgress() {
        const progress = document.getElementById('progress-bar');
        if (progress) progress.remove();
    }
}

// CSS стили для лоадеров
const loaderStyles = `
.skeleton-loader {
    padding: 20px;
}
.skeleton-line {
    height: 16px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton 1.5s infinite;
    margin-bottom: 10px;
    border-radius: 4px;
}
.skeleton-line.short {
    width: 60%;
}
@keyframes skeleton {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.spinner-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255,255,255,0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}
.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.spinner-text {
    margin-top: 15px;
    color: #667eea;
    font-weight: 600;
}
#progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: #f0f0f0;
    z-index: 10000;
}
.progress-fill {
    height: 100%;
    background: #667eea;
    transition: width 0.3s ease;
}
`;

// Добавляем стили в head
const style = document.createElement('style');
style.textContent = loaderStyles;
document.head.appendChild(style);