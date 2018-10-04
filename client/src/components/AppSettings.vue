<template>
    <div>
        <el-dropdown @command="menuItemSelected">
            <span class="el-dropdown-link">
                Icons
            </span>
            <el-dropdown-menu slot="dropdown">
                <el-dropdown-item command="about-app">About Icons</el-dropdown-item>
            </el-dropdown-menu>
        </el-dropdown>

        <about-app-dialog :dialogVisible="aboutAppDialogVisible" @finished="aboutAppDialogFinished"/>
    </div>
</template>

<script>
import AboutAppDialog from './AboutAppDialog';

export default {
    components: {
        'about-app-dialog': AboutAppDialog
    },
    data() {
        return {
            aboutAppDialogVisible: false
        };
    },
    methods: {
        menuItemSelected(command) {
            if (command === 'about-app') {
                this.aboutAppDialogVisible = true;
            }
        },
        aboutAppDialogFinished() {
            this.aboutAppDialogVisible = false;
        }
    }
}
</script>

<style lang='scss' scoped>
    .el-dropdown-link {
        font-size: 24px;
        cursor: pointer;
    }
</style>
