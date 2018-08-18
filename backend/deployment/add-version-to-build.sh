build_root=$(dirname $0)/../build
version=$(git describe --tags || :)
commit=$(git rev-parse HEAD)

cat > $build_root/version.json <<EOF
{
    "version": "$version",
    "commit": "$commit"
}
EOF
