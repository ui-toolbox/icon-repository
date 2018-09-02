#!/bin/bash

mkdir -p output
k6 run \
    -e ICONREPO_BASE_URL=http://ux:ux@127.0.0.1:8090 \
    --vus 5 \
    --duration 60s \
    --out json=output/create-icon-describe-all.json \
    backend/load-tests/test-cases/create-icon-describe-all.js

data_point_in_group_jql() {
    script_group="$1"
    metric="$2"
    echo ". | select(\
        .type==\"Point\" \
        and .metric == \"$metric\" \
        and .data.tags.group == \"$script_group\" \
        and .data.tags.status >= \"200\"\
    ) | .data.value"
}

count() {
    jq -s '{"count": length}'
}

avg() {
    jq -s '{"avg": (add / length)}'
}

min_p90_p95_max() {
    jq -s 'sort | .[0, (length * 0.9 | floor), (length * 0.95 | floor), length - 1]' \
        | jq -s '{"min": .[0]},{"p90": .[1]},{"p95": .[2]},{"max": .[3]}'
}

stats() {
    script_group="$1"
    metric="$2"
    echo ""
    echo "===================================================================="
    echo "Statistics for $script_group"
    echo "===================================================================="
    echo "$metric"
    echo "--------------------------------------------------------------------"
    jq "$(data_point_in_group_jql "$script_group" "$metric")" output/create-icon-describe-all.json | count
    jq "$(data_point_in_group_jql "$script_group" "$metric")" output/create-icon-describe-all.json | avg
    jq "$(data_point_in_group_jql "$script_group" "$metric")" output/create-icon-describe-all.json | min_p90_p95_max
}

stats "::Create icon" "http_req_duration"
stats "::Reload icons" "http_req_duration"
