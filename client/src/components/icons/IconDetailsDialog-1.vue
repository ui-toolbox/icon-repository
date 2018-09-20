<template>
    <el-dialog :title="dialogTitle" :visible="dialogVisible" :before-close="close" width="45%">
        <el-row class="icon-box-row">
            <el-col :span="24"><div class="icon-box bg-purple-dark"></div></el-col>
        </el-row>
        <el-row class="properties-row">
            <el-row>
                <el-col :span="24"><labeled-tag-collection :tags="iconTags" @tag-added="tagAdded" @tag-removed="tagRemoved"></labeled-tag-collection></el-col>
            </el-row>
            <el-row>
                <el-col :span="24"><div class="grid-content bg-purple-dark"></div></el-col>
            </el-row>
            <el-row>
                <el-col :span="24"><div class="grid-content bg-purple-dark"></div></el-col>
            </el-row>
            <el-row>
                <el-col :span="24"><div class="grid-content bg-purple-dark"></div></el-col>
            </el-row>
            <el-row>
                <el-col :span="24"><div class="grid-content bg-purple-dark"></div></el-col>
            </el-row>
        </el-row>
        <el-row class="button-row">
            <el-col :span="24"><div class="download_button bg-purple-dark"></div></el-col>
        </el-row>
    </el-dialog>
</template>

<script>
import LabeledTagCollection from '@/components/LabeledTagCollection';
import IconfileList from '@/components/icons/IconfileList';
import { createIconfileList } from '@/services/icon';
import { CANCELLED } from '@/services/constants';

export default {
    props: [
        "icon",
        "dialogVisible"
    ],
    components: {
        'labeled-tag-collection': LabeledTagCollection
    },
    data() {
        return {
            iconTags: [
                "krumpli",
                "alma"
            ]
        }
    },
    computed: {
        dialogTitle() {
            return `Details of: ${this.icon.name}`;
        },
        iconfileList() {
            return createIconfileList(this.icon.paths);
        }
    },
    methods: {
        tagAdded(tagValue) {
            this.iconTags.push(tagValue);
        },
        tagRemoved(tag) {
            this.iconTags.splice(this.iconTags.indexOf(tag), 1);
        },
        close() {
            this.hideDialog();
        },
        hideDialog() {
            this.$emit("finished", {
                status: CANCELLED
            });
        }
    }
}
</script>

<style lang="postcss" scoped>
  .el-row {
    margin-bottom: 10px;
  }
    .el-row.icon-box-row, .properties-row {
        margin-bottom: 30px;
    }
    .el-row:last-child {
        margin-bottom: 0;
    }
  .el-col {
    border-radius: 4px;
  }
  .bg-purple-dark {
    background: #99a9bf;
  }
  .bg-purple {
    background: #d3dce6;
  }
  .bg-purple-light {
    background: #e5e9f2;
  }
  .icon-box {
      min-height: 250px;
  }
  .grid-content {
    border-radius: 4px;
    min-height: 24px;
  }

  .download_button {
      min-height: 36px;
      margin: 10px 0 30px;
  }
  .row-bg {
    padding: 10px 0;
    background-color: #f9fafc;
  }
</style>
