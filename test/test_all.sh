tests=(
    "single_tests"

    "auth_tests_local"
    "auth_tests_redis"

    "vault_tests_local"
    "vault_tests_redis"
)

for item in "${tests[@]}"; do
    npm run $item
    error=$?
    if [ $error -ne 0 ]; then
        echo 'Error detected in tests.'
        break
    fi
    printf "\n\n\n\n\n"
done