set -x
project_root=$(dirname $0)/..
build_root=$project_root/build/src
version=$(jq -r '.version' $project_root/package.json || :)
commit=$(git rev-parse HEAD)

cat > $build_root/version.json <<EOF
{
    "version": "$version",
    "commit": "$commit",
    "buildTime": "$(date --rfc-3339=seconds)"
}
EOF
