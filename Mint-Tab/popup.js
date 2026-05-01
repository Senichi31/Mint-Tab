document.addEventListener('DOMContentLoaded', function () {
  // --- 1. 获取 DOM 元素 ---
  const sidebar = document.getElementById('sidebar');
  const gridContainer = document.getElementById('bookmark-grid');
  const folderNameTitle = document.getElementById('current-folder-name');
  const searchInput = document.getElementById('search-input');
  const globalSearchToggle = document.getElementById('search-global-toggle');
  const searchModeText = document.getElementById('search-mode-text');
  const themeToggle = document.getElementById('dark-mode-toggle');
  const themeText = document.getElementById('theme-text');
  const layoutToggle = document.getElementById('layout-toggle');
  const layoutText = document.getElementById('layout-text');
  const sortToggle = document.getElementById('sort-toggle');

  // --- 2. 状态初始化 (从存储读取) ---
  let currentFolderData = null;
  let fullBookmarkTree = [];
  
  // 排序状态
  let isSortedAZ = localStorage.getItem('isSortedAZ') === 'true';
  if (isSortedAZ) { sortToggle.classList.add('active'); }

// 搜索模式 Toggle 状态
  let isGlobalSearch = localStorage.getItem('isGlobalSearch') === 'true';
  globalSearchToggle.checked = isGlobalSearch;
  searchModeText.textContent = isGlobalSearch ? "All Folders" : "Current Folder";

  // 主题初始化
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  themeText.textContent = savedTheme === 'dark' ? 'Night' : 'Day';

  // 布局初始化
  let currentLayout = localStorage.getItem('layout') || 'grid-mode';
  gridContainer.className = `grid-container ${currentLayout}`;
  layoutToggle.textContent = currentLayout === 'grid-mode' ? '⊞' : '≡';
  layoutText.textContent = currentLayout === 'grid-mode' ? 'Grid' : 'List';

// --- 3. 核心渲染函数 ---
  function renderContent(items, isSearch = false) {
    gridContainer.innerHTML = '';
    
    // 安全检查：如果还没加载到文件夹数据，先显示加载中
    if (!isSearch && !currentFolderData) {
      folderNameTitle.textContent = "Loading...";
      return;
    }

    folderNameTitle.textContent = isSearch ? "Search Results" : (currentFolderData.title || "Bookmarks");

    let displayItems = [...items].filter(i => i.url);

    // 排序逻辑
    if (isSortedAZ) {
      displayItems.sort((a, b) => {
        const titleA = (a.title || a.url).toLowerCase();
        const titleB = (b.title || b.url).toLowerCase();
        return titleA.localeCompare(titleB);
      });
    }

    displayItems.forEach(child => {
      const item = document.createElement('a');
      item.className = 'bookmark-item';
      item.href = child.url;
      
      const icon = document.createElement('img');
      // 使用 chrome 扩展内置图标获取方式或 google 服务
      icon.src = `https://www.google.com/s2/favicons?domain=${new URL(child.url).hostname}&sz=64`;
      
      const infoContainer = document.createElement('div');
      infoContainer.className = 'item-info';

      const titleText = document.createElement('span');
      titleText.className = 'item-title';
      titleText.textContent = child.title || child.url;

      const urlText = document.createElement('span');
      urlText.className = 'item-url';
      urlText.textContent = child.url;

      infoContainer.appendChild(titleText);
      infoContainer.appendChild(urlText);
      item.appendChild(icon);
      item.appendChild(infoContainer);
      gridContainer.appendChild(item);
    });
  }

// --- 4. 搜索逻辑 ---
  function handleSearch() {
    const query = searchInput.value.toLowerCase();
    if (query === '') { 
      if (currentFolderData) renderContent(currentFolderData.children); 
      return; 
    }
    
    if (globalSearchToggle.checked) {
      const results = [];
      function searchAll(nodes) {
        nodes.forEach(n => {
          if (n.url && (n.title.toLowerCase().includes(query) || n.url.toLowerCase().includes(query))) {
            results.push(n);
          }
          if (n.children) searchAll(n.children);
        });
      }
      searchAll(fullBookmarkTree);
      renderContent(results, true);
    } else {
      const results = currentFolderData.children.filter(c => 
        c.url && (c.title.toLowerCase().includes(query) || c.url.toLowerCase().includes(query))
      );
      renderContent(results, false);
    }
  }

// --- 5. 加载书签数据并初始化侧边栏 ---
  chrome.bookmarks.getTree(function (nodes) {
    fullBookmarkTree = nodes;
    const sidebarItems = [];

    function processNodes(node) {
      if (node.children) {
        const hasDirectBookmarks = node.children.some(c => c.url);
        let displayTitle = node.title;
        
        // 映射默认文件夹名称
        if (!node.title && node.id === '0') displayTitle = "Root";
        if (node.id === '1') displayTitle = "Bookmarks Bar";
        if (node.id === '2') displayTitle = "Other Bookmarks";

        // 只有包含书签的文件夹或特定的根文件夹才显示在侧边栏
        if (hasDirectBookmarks || node.id === '1' || node.id === '2') {
          sidebarItems.push({ title: displayTitle, children: node.children, id: node.id });
        }
        node.children.forEach(processNodes);
      }
    }
    nodes.forEach(processNodes);

    // 渲染侧边栏
    sidebarItems.forEach((item, index) => {
      const navItem = document.createElement('div');
      navItem.className = 'sidebar-item';
      navItem.textContent = item.title;
      navItem.setAttribute('data-id', item.id);
      
      navItem.onclick = () => {
        searchInput.value = '';
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        navItem.classList.add('active');
        currentFolderData = item;
	// 保存当前文件夹 ID---
	localStorage.setItem('lastFolderId', item.id);
        renderContent(item.children);
      };
      
      sidebar.appendChild(navItem);
    });

    // 初始化自动点击逻辑：直接在回调函数内读取，避开作用域问题
    const allNavItems = Array.from(document.querySelectorAll('.sidebar-item'));
    const savedId = localStorage.getItem('lastFolderId'); // 重新获取一遍最稳
    
    let targetItem = null;
    if (savedId) {
      targetItem = allNavItems.find(el => el.getAttribute('data-id') === savedId);
    }
    
    // 如果没找到记忆的文件夹，默认点击“书签栏”(ID: 1)
    if (!targetItem) {
      targetItem = allNavItems.find(el => el.getAttribute('data-id') === '1') || allNavItems[0];
    }

    if (targetItem) {
      targetItem.click();
    }
  });

// --- 6. 事件监听 ---
  searchInput.oninput = handleSearch;

// 保存状态到本地存储
  globalSearchToggle.onchange = () => {
    localStorage.setItem('isGlobalSearch', globalSearchToggle.checked);
    searchModeText.textContent = globalSearchToggle.checked ? "All Folders" : "Current Folder";
    handleSearch();
  };

  sortToggle.onclick = () => {
    isSortedAZ = !isSortedAZ;
    localStorage.setItem('isSortedAZ', isSortedAZ);
    sortToggle.classList.toggle('active', isSortedAZ);
    if (searchInput.value) {
      handleSearch();
    } else if (currentFolderData) {
      renderContent(currentFolderData.children);
    }
  };

  themeToggle.onclick = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    themeText.textContent = newTheme === 'dark' ? 'Night' : 'Day';
  };

  layoutToggle.onclick = () => {
    currentLayout = (currentLayout === 'grid-mode' ? 'list-mode' : 'grid-mode');
    gridContainer.className = `grid-container ${currentLayout}`;
    localStorage.setItem('layout', currentLayout);
    layoutToggle.textContent = currentLayout === 'grid-mode' ? '⊞' : '≡';
    layoutText.textContent = currentLayout === 'grid-mode' ? 'Grid' : 'List';

    // 布局切换后，如果有数据，重新渲染以确保样式应用正确
          if (searchInput.value) {
              handleSearch();
           } else if (currentFolderData) {
              renderContent(currentFolderData.children);
           }
  };
});