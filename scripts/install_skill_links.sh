#!/usr/bin/env sh
# 把仓库里的 skills/measure 软链到 Claude Code 和 Codex 的用户级 skill 目录（~/.claude/skills、~/.agents/skills）。
# 先检查两个目录，都没问题才统一创建链接，不会只装一半：
# - 同名的普通目录或文件：不动，报错退出；
# - 同名软链指向别处：不动，报错退出；确认要替换时加 --replace；
# - 同名软链已经指向本仓库：保持不变。
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)"
SKILL_NAME="measure"
SRC="$ROOT_DIR/skills/$SKILL_NAME"
REPLACE=0

for arg in "$@"; do
  case "$arg" in
    --replace) REPLACE=1 ;;
    *) echo "不认识的参数：$arg（只支持 --replace）" >&2; exit 2 ;;
  esac
done

if [ ! -f "$SRC/SKILL.md" ]; then
  echo "未找到 $SRC/SKILL.md" >&2
  exit 1
fi

for dir in "$HOME/.agents/skills" "$HOME/.claude/skills"; do
  dest="$dir/$SKILL_NAME"
  if [ -L "$dest" ]; then
    target="$(readlink "$dest")"
    resolved="$(CDPATH= cd -- "$dest" 2>/dev/null && pwd -P || printf '%s' "$target")"
    if [ "$resolved" != "$SRC" ] && [ "$REPLACE" -ne 1 ]; then
      echo "$dest 已是软链，指向 $target，不是本仓库。没有改动任何目录。确认要替换时加 --replace 重新运行。" >&2
      exit 1
    fi
  elif [ -e "$dest" ]; then
    echo "$dest 已存在而且不是软链，没有改动任何目录。请先自己确认后移走。" >&2
    exit 1
  fi
done

for dir in "$HOME/.agents/skills" "$HOME/.claude/skills"; do
  mkdir -p "$dir"
  ln -sfn "$SRC" "$dir/$SKILL_NAME"
  test -f "$dir/$SKILL_NAME/SKILL.md"
done

echo "已安装 skill 软链："
for dir in "$HOME/.agents/skills" "$HOME/.claude/skills"; do
  echo "- $dir/$SKILL_NAME -> $SRC"
done
echo "校验器还需要单独安装：npm install -g measure-cjk@0.1.0（或在仓库里 npm install -g ./packages/cli）"
