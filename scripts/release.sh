#!/bin/bash

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting release process for code-review-tool...${NC}\n"

# 检查当前分支
echo -e "${BLUE}Checking current branch...${NC}"
current_branch=$(git rev-parse --abbrev-ref HEAD)
echo -e "${GREEN}✓ Current branch: ${current_branch}${NC}\n"

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Found uncommitted changes${NC}"
    read -p "Do you want to commit them automatically? (y/N) " confirm_commit
    if [[ $confirm_commit =~ ^[Yy]$ ]]; then
        git add .
        git commit --no-verify -m "chore: prepare for release" || exit 1
        echo -e "${GREEN}✓ Changes committed${NC}\n"
    else
        echo -e "${RED}❌ Please commit or stash your changes before releasing${NC}"
        exit 1
    fi
fi

# 检查分支是否为最新
echo -e "${BLUE}Checking if branch is up to date...${NC}"
git fetch origin >/dev/null 2>&1

local_commit=$(git rev-parse HEAD)
remote_commit=$(git rev-parse origin/$current_branch 2>/dev/null || echo "")

if [ -n "$remote_commit" ]; then
    behind_count=$(git rev-list --count HEAD..origin/$current_branch 2>/dev/null || echo "0")
    ahead_count=$(git rev-list --count origin/$current_branch..HEAD 2>/dev/null || echo "0")
    
    if [ "$behind_count" -gt 0 ]; then
        echo -e "${RED}❌ Your local branch is $behind_count commit(s) behind the remote branch${NC}"
        echo "Please pull the latest changes: git pull origin $current_branch"
        exit 1
    fi
    
    if [ "$ahead_count" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Your local branch is $ahead_count commit(s) ahead of the remote branch${NC}"
        read -p "Do you want to continue with release? (y/N) " confirm_ahead
        if [[ ! $confirm_ahead =~ ^[Yy]$ ]]; then
            echo "Release cancelled. Please push your commits first: git push origin $current_branch"
            exit 1
        fi
    fi
fi

echo -e "${GREEN}✓ Branch check passed${NC}\n"

# 检查 Node.js 版本
echo -e "${BLUE}Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

node_version=$(node -v)
echo -e "${GREEN}✓ Node.js version: ${node_version}${NC}\n"

# 检查 pnpm
echo -e "${BLUE}Checking pnpm...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Please install it: npm install -g pnpm${NC}"
    exit 1
fi
echo -e "${GREEN}✓ pnpm is available${NC}\n"

# 安装依赖
echo -e "${BLUE}Installing dependencies...${NC}"
pnpm install || exit 1
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# 构建 CLI
echo -e "${BLUE}Building CLI...${NC}"
pnpm run build || exit 1
echo -e "${GREEN}✓ CLI built successfully${NC}\n"

# 构建 UI
echo -e "${BLUE}Building UI...${NC}"
pnpm run build:ui || exit 1
echo -e "${GREEN}✓ UI built successfully${NC}\n"

# 读取当前版本
current_version=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version: ${current_version}${NC}"

# 询问新版本号
read -p "Enter new version (current: $current_version, or press Enter to keep current): " new_version
if [ -z "$new_version" ]; then
    new_version=$current_version
fi

# 更新版本号
if [ "$new_version" != "$current_version" ]; then
    echo -e "${BLUE}Updating version to ${new_version}...${NC}"
    npm version "$new_version" --no-git-tag-version || exit 1
    echo -e "${GREEN}✓ Version updated to ${new_version}${NC}\n"
fi

# 检查 npm 登录状态
echo -e "${BLUE}Checking npm login status...${NC}"
if ! npm whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to npm${NC}"
    read -p "Do you want to login now? (y/N) " confirm_login
    if [[ $confirm_login =~ ^[Yy]$ ]]; then
        npm login || exit 1
    else
        echo -e "${RED}❌ Please login to npm before publishing${NC}"
        exit 1
    fi
fi

npm_user=$(npm whoami)
echo -e "${GREEN}✓ Logged in as: ${npm_user}${NC}\n"

# 确认发布
echo -e "${YELLOW}⚠️  Ready to publish:${NC}"
echo -e "  Package: @acr/ai-code-review"
echo -e "  Version: ${new_version}"
echo -e "  User: ${npm_user}"
echo ""
read -p "Do you want to publish to npm? (y/N) " confirm_publish

if [[ ! $confirm_publish =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Release cancelled${NC}"
    exit 0
fi

# 发布到 npm
echo -e "${BLUE}Publishing to npm...${NC}"
npm publish --access public || exit 1
echo -e "${GREEN}✓ Published successfully${NC}\n"

# 提交版本更改
if [ "$new_version" != "$current_version" ]; then
    echo -e "${BLUE}Committing version changes...${NC}"
    git add package.json package-lock.json 2>/dev/null || true
    git add pnpm-lock.yaml 2>/dev/null || true
    git commit --no-verify -m "chore: bump version to ${new_version}" || exit 1
    echo -e "${GREEN}✓ Version changes committed${NC}\n"
fi

# 创建 git tag
echo -e "${BLUE}Creating git tag...${NC}"
git tag -a "v${new_version}" -m "Release v${new_version}" || exit 1
echo -e "${GREEN}✓ Git tag created: v${new_version}${NC}\n"

# 推送到远程
read -p "Do you want to push changes and tags to remote? (y/N) " should_push

if [[ $should_push =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Pushing to remote...${NC}"
    git push origin "$current_branch" || exit 1
    git push origin "v${new_version}" || exit 1
    echo -e "${GREEN}✓ Pushed to remote${NC}\n"
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Release completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Package: @acr/ai-code-review@${new_version}"
echo -e "Install: npm install -g @acr/ai-code-review@${new_version}"
echo ""


