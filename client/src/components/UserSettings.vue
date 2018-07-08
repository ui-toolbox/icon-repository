<template>
    <div class="user-area">
        <div class="user-settings-head" :class="{ 'authenticated-user': user.authenticated }" @click="showItems = !showItems">
            <div class="user-settings-head-content">
                <img src="@/assets/User.svg" height="27"/>
                <span class="user-name">{{ user.username }}</span>
                <div class="arrow-down" v-if="user.authenticated"/>
            </div>
        </div>
        <ul v-if="user.authenticated && showItems" class="user-settings-items" @click="logout">
            <li>Logout</li>
        </ul>
    </div>
</template>

<script>
import * as user from '@/services/user';

export default {
    name: 'UserSettings',
    props: ['user', 'logoutUrl'],
    created() {
        this.showItems = false;
    },
    data() {
        return {
            showItems: this.showItems
        }
    },
    methods: {
        logout: function() {
            fetch(this.logoutUrl, {
                method: "POST",
                mode: "no-cors",
                credentials: "include"
            }).then(response => {
                window.location = this.$config.baseUrl;
            });
        }
    }
}
</script>

<style lang='scss'>
$highlighted: #ffbd4d;

.user-area {
    float: right;
    font-size: 18px;
    cursor: pointer;

    .user-settings-head {
        margin: 0 5px;
        padding: 5px 10px;

        .user-name {
            vertical-align: middle;
            margin: 0 3px;
        }
        .arrow-down {
            display: inline-block;
            vertical-align: middle;
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 4px solid #2c3e50;
        }
        &:hover.authenticated-user {
            background-color: $highlighted;
        }
    }

    .user-settings-items {
        list-style: none;
        font-size: 14px;
        margin: 5px;
        padding: 5px 0 5px 40px;
        &:hover {
            background-color: $highlighted;
        }
    }
}
</style>
