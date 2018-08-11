<template>
    <el-dialog :title="dialogTitle" :visible="dialogVisible" :before-close="close" width="30%">
        <el-tabs v-model="activeOperation">
            <el-tab-pane label="Add icon-file to icon" name="addfile">
                    <add-iconfile
                        :formats="formats"
                        :sizes="sizes"
                        :iconName="icon.name"
                        @iconfileAdded="iconfileAdded"
                        />
            </el-tab-pane>
            <el-tab-pane label="List/delete icon-file(s)" name="listfiles">
                    <iconfile-list
                        :iconfiles="iconfileList"
                        @removeIconfile="removeIconfile"/>
                    <span slot="footer" class="dialog-footer">
                        <el-button type="primary" @click="close">Close</el-button>
                    </span>
            </el-tab-pane>
            <el-tab-pane label="Rename or delete icon" name="rename-delete-icon">
                <div>
                    <el-row type="flex">
                        <el-col :span="16">
                            <div class="icon-name-input">
                                <el-input v-model="newIconName"/>
                            </div>
                        </el-col>
                        <el-col :span="6" :offset="1">
                            <el-button type="primary" @click="renameCurrentIcon">Rename icon</el-button>
                        </el-col>
                    </el-row>
                    <el-row>
                        <el-col :span="6" :offset="17">
                            <el-button icon="el-icon-delete" type="danger" @click="deleteIcon">Delete icon</el-button>
                        </el-col>
                    </el-row>
                </div>
            </el-tab-pane>
        </el-tabs>
    </el-dialog>
</template>

<script>
import { List } from 'immutable';
import { describeIcon, renameIcon, deleteIcon, deleteIconfile } from '@/services/icon';
import IconfileList from '@/components/IconfileList'
import AddIconfile from '@/components/AddIconfile';
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';
import getEndpointUrl from '@/services/url';

export default {
    props: [
        "icon",
        "formats",
        "sizes",
        "dialogVisible"
    ],
    components: {
        'iconfile-list': IconfileList,
        'add-iconfile': AddIconfile
    },
    computed: {
        dialogTitle() {
            return `Edit icon: ${this.iconInfo.name}`;
        },
        iconfileList() {
            return this.createIconfileList(this.iconInfo);
        }
    },
    data() {
        return {
            iconInfo: this.icon,
            newIconName: this.icon.name,
            activeOperation: "listfiles"
        }
    },
    methods: {
        createIconfileList() {
            return List(Object.keys(this.iconInfo.paths))
            .flatMap(format => Object.keys(this.iconInfo.paths[format])
                .map(size => {
                    const path = this.iconInfo.paths[format][size];
                    const url = getEndpointUrl(path);
                    return { format, size, path, url };
                }))
            .toArray();
        },
        refreshIconfileList() {
            return describeIcon(this.iconInfo.name)
                    .then(info => this.iconInfo = info)

        },
        iconfileAdded() {
            this.refreshIconfileList()
            .then(
                () => this.activeOperation = 'listfiles'
            );
        },
        renameCurrentIcon() {
            renameIcon(this.iconInfo.name, this.newIconName)
            .then(
                () => {
                    this.iconInfo.name = this.newIconName;
                    this.$showSuccessMessage("Icon renamed");
                },
                error => this.$showErrorMessage(error)
            );
        },
        deleteIcon() {
            this.$confirm(`Are you sure to delete the icon "${this.iconInfo.name}"?`)
            .then(
                () => deleteIcon(this.iconInfo.name)
                        .then(
                            () => {
                                this.hideDialog(SUCCESSFUL);
                                this.$showSuccessMessage("Icon deleted");
                            },
                            error => this.hideDialog(FAILED, error)
                        ),
                () => undefined
            )
            .catch(error => this.hideDialog(FAILED, error));
        },
        isLastIconfile() {
            return this.createIconfileList(this.iconInfo).length === 1;
        },
        deleteIconfile(iconfileToDelete) {
            deleteIconfile(iconfileToDelete.path)
            .then(
                () => {
                    if (this.isLastIconfile()) {
                        this.$showSuccessMessage("Icon deleted");
                        this.hideDialog();
                    } else {
                        this.$showSuccessMessage("Icon-file deleted");
                        this.refreshIconfileList()
                    }
                }
            )
        },
        createRemoveIconfileConfirmationMessage(iconfileToDelete) {
            const baseMessage = `Are you sure to delete the icon file for format ${iconfileToDelete.format} and size ${iconfileToDelete.size}?`;
            return this.isLastIconfile()
                ? baseMessage + ` Since this is the last icon file associated with it, ` +
                    `the icon ${this.iconInfo.name} itself will be also deleted!`
                : baseMessage;
        },
        removeIconfile(iconfileToDelete) {
            this.$confirm(this.createRemoveIconfileConfirmationMessage(iconfileToDelete))
            .then(
                () => this.deleteIconfile(iconfileToDelete),
                () => undefined
            )
            .catch(error => this.hideDialog(FAILED, error));
        },
        close() {
            this.hideDialog(SUCCESSFUL);
        },
        hideDialog(status = SUCCESSFUL, error) {
            this.$emit("finished", {
                status,
                error
            });
        }
    }

}
</script>

<style lang="postcss" scoped>
    .icon-name-input {
        min-width: 200px;
    }
    .el-row {
        margin-bottom: 20px;
        &:last-child {
           margin-bottom: 0;
        }
    }
</style>
