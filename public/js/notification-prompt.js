/**
 * Notification Permission Prompt Handler
 * Checks notification permission status and prompts user if needed
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    // How long to wait before showing prompt (milliseconds)
    delayBeforePrompt: 3000, // 3 seconds
    // Show prompt again after this many days if dismissed
    promptCooldownDays: 7,
    // LocalStorage keys
    storageKeys: {
      lastPrompted: 'notification_last_prompted',
      userDismissed: 'notification_user_dismissed',
      permissionGranted: 'notification_permission_granted'
    }
  };

  /**
   * Check if notifications are supported
   */
  function isNotificationSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get current notification permission status
   */
  function getPermissionStatus() {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission; // 'default', 'granted', or 'denied'
  }

  /**
   * Check if we should show the prompt
   */
  function shouldShowPrompt() {
    // Don't show if not supported
    if (!isNotificationSupported()) {
      console.log('[NotificationPrompt] Notifications not supported');
      return false;
    }

    const permission = Notification.permission;

    // Don't show if already granted or permanently denied
    if (permission === 'granted') {
      localStorage.setItem(CONFIG.storageKeys.permissionGranted, 'true');
      return false;
    }
    if (permission === 'denied') {
      console.log('[NotificationPrompt] Permission denied by user');
      return false;
    }

    // Check if user dismissed recently
    const lastPrompted = localStorage.getItem(CONFIG.storageKeys.lastPrompted);
    const userDismissed = localStorage.getItem(CONFIG.storageKeys.userDismissed);

    if (lastPrompted && userDismissed === 'true') {
      const daysSincePrompt = (Date.now() - parseInt(lastPrompted)) / (1000 * 60 * 60 * 24);
      if (daysSincePrompt < CONFIG.promptCooldownDays) {
        console.log('[NotificationPrompt] User dismissed recently, waiting for cooldown');
        return false;
      }
    }

    return true;
  }

  /**
   * Create and show notification permission prompt UI
   */
  function showPromptUI() {
    // Check if prompt already exists
    if (document.getElementById('notification-prompt-banner')) {
      return;
    }

    // Create banner element
    const banner = document.createElement('div');
    banner.id = 'notification-prompt-banner';
    banner.className = 'notification-prompt-banner';
    banner.innerHTML = `
      <div class="notification-prompt-content">
        <div class="notification-prompt-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <div class="notification-prompt-text">
          <strong>Stay Updated!</strong>
          <span>Enable notifications to receive important updates and announcements.</span>
        </div>
        <div class="notification-prompt-actions">
          <button class="notification-prompt-btn notification-prompt-btn-primary" id="notification-enable-btn">
            Enable Notifications
          </button>
          <button class="notification-prompt-btn notification-prompt-btn-secondary" id="notification-dismiss-btn">
            Maybe Later
          </button>
        </div>
        <button class="notification-prompt-close" id="notification-close-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('notification-prompt-styles')) {
      const styles = document.createElement('style');
      styles.id = 'notification-prompt-styles';
      styles.textContent = `
        .notification-prompt-banner {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          max-width: 600px;
          width: calc(100% - 40px);
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          z-index: 999999;
          animation: slideDown 0.3s ease-out;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .notification-prompt-content {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          position: relative;
        }

        .notification-prompt-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .notification-prompt-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .notification-prompt-text strong {
          font-size: 15px;
          font-weight: 600;
          color: #1a202c;
        }

        .notification-prompt-text span {
          font-size: 14px;
          color: #4a5568;
          line-height: 1.4;
        }

        .notification-prompt-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .notification-prompt-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .notification-prompt-btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .notification-prompt-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .notification-prompt-btn-secondary {
          background: #f7fafc;
          color: #4a5568;
          border: 1px solid #e2e8f0;
        }

        .notification-prompt-btn-secondary:hover {
          background: #edf2f7;
        }

        .notification-prompt-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: #a0aec0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .notification-prompt-close:hover {
          background: #f7fafc;
          color: #4a5568;
        }

        @media (max-width: 640px) {
          .notification-prompt-banner {
            top: 10px;
            width: calc(100% - 20px);
          }

          .notification-prompt-content {
            flex-wrap: wrap;
            padding: 14px 16px;
          }

          .notification-prompt-actions {
            width: 100%;
            margin-top: 8px;
          }

          .notification-prompt-btn {
            flex: 1;
          }

          .notification-prompt-text span {
            font-size: 13px;
          }
        }
      `;
      document.head.appendChild(styles);
    }

    // Add to document
    document.body.appendChild(banner);

    // Attach event listeners
    document.getElementById('notification-enable-btn').addEventListener('click', handleEnableClick);
    document.getElementById('notification-dismiss-btn').addEventListener('click', handleDismissClick);
    document.getElementById('notification-close-btn').addEventListener('click', handleDismissClick);

    console.log('[NotificationPrompt] Prompt displayed');
  }

  /**
   * Handle enable button click
   */
  async function handleEnableClick() {
    console.log('[NotificationPrompt] User clicked enable');
    
    try {
      const permission = await Notification.requestPermission();
      console.log('[NotificationPrompt] Permission result:', permission);

      if (permission === 'granted') {
        localStorage.setItem(CONFIG.storageKeys.permissionGranted, 'true');
        localStorage.removeItem(CONFIG.storageKeys.userDismissed);
        
        // Show success message
        showSuccessMessage();
        
        // Dispatch custom event for app to handle subscription
        window.dispatchEvent(new CustomEvent('notificationPermissionGranted', {
          detail: { permission }
        }));
      } else if (permission === 'denied') {
        showDeniedMessage();
      }

      removePromptUI();
    } catch (error) {
      console.error('[NotificationPrompt] Error requesting permission:', error);
      removePromptUI();
    }
  }

  /**
   * Handle dismiss button click
   */
  function handleDismissClick() {
    console.log('[NotificationPrompt] User dismissed prompt');
    localStorage.setItem(CONFIG.storageKeys.lastPrompted, Date.now().toString());
    localStorage.setItem(CONFIG.storageKeys.userDismissed, 'true');
    removePromptUI();
  }

  /**
   * Remove prompt UI from DOM
   */
  function removePromptUI() {
    const banner = document.getElementById('notification-prompt-banner');
    if (banner) {
      banner.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => banner.remove(), 300);
    }
  }

  /**
   * Show success message
   */
  function showSuccessMessage() {
    const message = document.createElement('div');
    message.className = 'notification-prompt-banner';
    message.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    message.innerHTML = `
      <div class="notification-prompt-content" style="justify-content: center; color: white;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <strong>Notifications Enabled!</strong>
      </div>
    `;
    document.body.appendChild(message);
    setTimeout(() => {
      message.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => message.remove(), 300);
    }, 3000);
  }

  /**
   * Show denied message
   */
  function showDeniedMessage() {
    const message = document.createElement('div');
    message.className = 'notification-prompt-banner';
    message.style.background = '#f97316';
    message.innerHTML = `
      <div class="notification-prompt-content" style="justify-content: center; color: white; font-size: 14px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>You can enable notifications later in your browser settings</span>
      </div>
    `;
    document.body.appendChild(message);
    setTimeout(() => {
      message.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => message.remove(), 300);
    }, 4000);
  }

  /**
   * Initialize the notification prompt
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    console.log('[NotificationPrompt] Initializing...');

    // Check if we should show the prompt
    if (!shouldShowPrompt()) {
      console.log('[NotificationPrompt] Not showing prompt');
      return;
    }

    // Show prompt after delay
    setTimeout(() => {
      showPromptUI();
      localStorage.setItem(CONFIG.storageKeys.lastPrompted, Date.now().toString());
    }, CONFIG.delayBeforePrompt);
  }

  // Add slideUp animation
  const slideUpStyle = document.createElement('style');
  slideUpStyle.textContent = `
    @keyframes slideUp {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
    }
  `;
  document.head.appendChild(slideUpStyle);

  // Public API
  window.NotificationPrompt = {
    show: showPromptUI,
    hide: removePromptUI,
    checkPermission: getPermissionStatus,
    isSupported: isNotificationSupported
  };

  // Auto-initialize
  init();
})();
