<template>
    <div class="user-area">
        <div class="account-settings-head" :class="{ 'authenticated-user': user.authenticated }">
            <el-dropdown type="info" @command="itemSelected">
                <span class="el-dropdown-link">
                    <i class="material-icons md-36 account-button-element">account_circle</i>
                    <span class="account-button-element">{{ user.username }}</span>
                    <i class="el-icon-arrow-down el-icon--right account-button-element"/>
                </span>
                <el-dropdown-menu slot="dropdown">
                    <el-dropdown-item command="logout">Logout</el-dropdown-item>
                </el-dropdown-menu>
            </el-dropdown>
        </div>
    </div>
</template>

<script>
import getEndpointUrl from '@/services/url';
import * as userService from '@/services/user';

export default {
    name: 'UserSettings',
    props: ['user', 'logoutUrl'],
    methods: {
        itemSelected(command) {
            if (command === 'logout') {
                userService.logout();
            }
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

    .account-settings-head {
        margin: 0 5px;
        padding: 5px 10px;

        .account-button-element {
            vertical-align: middle;
        }

        .md-36 {
            font-size: 36px;
        }
    }

}
</style>
